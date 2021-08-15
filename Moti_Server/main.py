import argparse
import datetime
import json
import statistics
import urllib
from threading import Thread
from urllib.parse import urlparse
from http.server import HTTPServer, BaseHTTPRequestHandler
import firebase_admin
import requests
from firebase_admin import credentials
from firebase_admin import firestore
from difflib import SequenceMatcher
import random
import additionals
import spacy
import schedule
import time
from exponent_server_sdk import (
    DeviceNotRegisteredError,
    PushClient,
    PushMessage,
    PushServerError,
    PushTicketError,
)

NEW_CENTROID_THRESHOLD = 10
NAME_MODIFIER = 10
DESC_MODIFIER = 3
LOCATION_MODIFIER = 5
PARTICIPANTS_MODIFIER = 5
TIME_MODIFIER = 5
TOTAL_MODIFIERS = NAME_MODIFIER + DESC_MODIFIER + LOCATION_MODIFIER + PARTICIPANTS_MODIFIER + TIME_MODIFIER
CONNECTION_WORDS = ['in', 'the', 'on', 'with', 'to', 'a', 'an', 'and', 'as', 'for', 'at']
EPOCHS = 3
NUMBER_OF_SECONDS_A_DAY = 86400
MARGIN_TO_SCHEDULE_MEETING = 24  # hours
CONVERT_TO_UTC_3 = True
SCORE_THRESHOLD = 0.9
TOILET_PAPER = ''

cred = credentials.Certificate('res/firebase_key.json')
firebase_admin.initialize_app(cred)
db = firestore.client()

doc2 = db.collection('unicorns').document('google')
doc = doc2.get()
if doc.exists:
    TOILET_PAPER = doc.to_dict()['key']
else:
    print('error getting unicorn from fb')

nlp = spacy.load('en_core_web_md')


def spacy_similarity(a, b):
    # create nlp vector for each string, then check similarity
    token1 = nlp(a)
    token2 = nlp(b)
    return token1.similarity(token2)


def date_similarity(a, b):
    # check date similarity
    score = 0
    day_a = a.strftime("%A")
    day_b = b.strftime("%A")
    if day_a == day_b:
        score += 0.5
    hours_a = a.hour + a.minute / 60
    hours_b = b.hour + b.minute / 60
    hours_diff = abs(hours_a - hours_b)
    if hours_diff <= 2.25:
        score += ((2.25 - hours_diff) / 2.25) * 0.5
    return score


def participants_similarity(a, b):
    # check common participants between two meetings
    common = set(a).intersection(b)
    smaller = len(a)
    if len(b) > smaller:
        smaller = len(b)
    res = len(common) / smaller
    return res


def meeting_similarity(a, b):
    # check the similarity score of two meetings
    name_a = a['name']
    desc_a = a['description']
    date_a = a['date']
    location_a = a['location']
    participants_a = a['participants']
    name_b = b['name']
    desc_b = b['description']
    date_b = b['date']
    location_b = b['location']
    participants_b = b['participants']

    # checking similarities while using weights
    name = spacy_similarity(name_a, name_b) * NAME_MODIFIER
    desc = spacy_similarity(desc_a, desc_b) * DESC_MODIFIER
    loc = spacy_similarity(location_a, location_b) * LOCATION_MODIFIER
    par = participants_similarity(participants_a, participants_b) * PARTICIPANTS_MODIFIER
    date = date_similarity(date_a, date_b) * TIME_MODIFIER
    score = name + desc + loc + par + date

    return score


def calculate_avg_timing(meetings):
    # return avg time between meetings (days) and last meeting date. {avg_interval:xx,last:dd}
    # returns interval=-1 if only 1 meetings
    # return last=None if there are no past meetings
    if len(meetings) == 1:
        return {'avg_interval': -1, 'last': meetings[0]['date']}
    meetings.sort(key=lambda x: x['date'])  # sort by date
    intervals = []
    for i in range(len(meetings) - 1):
        date_sub = meetings[i + 1]['date'] - meetings[i]['date']
        intervals.append(date_sub.days + (date_sub.seconds / NUMBER_OF_SECONDS_A_DAY))
    mean = statistics.mean(intervals)

    now = datetime.datetime.now()
    last = None
    for meet in reversed(meetings):
        if meet['date'].timestamp() < now.timestamp():
            last = meet['date']
            break
    return {'avg_interval': mean, 'last': last}


def calculate_score_from_timing_data(timing_data):
    # calculating score for the cluster's timing to see if its relevant now
    now = datetime.datetime.now(datetime.timezone.utc)
    last = timing_data['last']
    interval = timing_data['avg_interval']
    if last is None:
        return 0
    if interval == -1 or interval == 0:
        return 0.6
    # when will we want the meeting to take place
    desired_date = now + datetime.timedelta(hours=MARGIN_TO_SCHEDULE_MEETING)

    # last meeting date + cluster time interval -> a prediction for when the next meeting should occur
    predicted_date = last + datetime.timedelta(days=interval)

    # calculating the time difference between the desired and predicted dates, in days
    if desired_date > predicted_date:
        margin = desired_date - predicted_date
    else:
        margin = predicted_date - desired_date
    margin = margin.days + margin.seconds / NUMBER_OF_SECONDS_A_DAY

    # checking how close the current time is to the interval
    closeness_to_interval = margin % interval  # the closer to 0 or to 'interval' - the better
    # checking that the time is upcoming
    if closeness_to_interval > interval / 2:
        closeness_to_interval = interval - closeness_to_interval
    score = (interval - closeness_to_interval) / interval
    return score


def get_date_from_avg_time(hrs):
    # we have the avg time, creating date
    now = datetime.datetime.now(datetime.timezone.utc)
    desired_date = now + datetime.timedelta(hours=MARGIN_TO_SCHEDULE_MEETING)
    # the desired date with the avg cluster time
    avg_date = datetime.datetime(desired_date.year, desired_date.month, desired_date.day, int(hrs), int((hrs % 1) * 60))

    if CONVERT_TO_UTC_3:
        desired_date += datetime.timedelta(hours=3)
        avg_date += datetime.timedelta(hours=3)

    # choosing a time while considering desired date and avg date
    res_date = datetime.datetime.fromtimestamp((desired_date.timestamp() * 0.4 + avg_date.timestamp() * 1.6) / 2)

    time = res_date.hour + res_date.minute / 60
    next_day = 0
    time = round(time * 4) / 4  # round by 0.25
    if time >= 24:
        next_day = 1
        time = time % 24
    date = {'year': res_date.year, 'month': res_date.month, 'day': res_date.day + next_day,
            'hours': int(time), 'mins': int((time % 1) * 60)}
    return date


def get_participants_from_dict(participants_count):
    # the param is a dict specifying how many times each participant took place in a meeting in the cluster
    count = {}
    # reversing the dict based on keys (appearances of the user in meetings in the cluster)
    for key in participants_count:
        if participants_count[key] not in count:
            count[participants_count[key]] = [key]
        else:
            count[participants_count[key]].append(key)

    keys = list(count.keys())
    keys.sort(reverse=True)
    # getting 70% of highest attending participants
    keys = keys[0:int(round(0.7 * len(keys)))]
    participants = []
    for key in keys:
        participants += count[key]
    return participants


def generate_meeting_from_cluster(cluster):
    # generating a meeting from the selected cluster
    # choosing a random meeting from the cluster
    meeting_model = random.choice(cluster)
    name = meeting_model['name']
    description = meeting_model['description']
    location = meeting_model['location']
    # calculate time and participants:
    time_sum = 0
    participants_count = {}
    for meeting in cluster:
        time_sum += meeting['date'].hour + meeting['date'].minute / 60
        for participant in meeting['participants']:
            if participant not in participants_count:
                participants_count[participant] = 1
            else:
                participants_count[participant] += 1

    hrs = time_sum / len(cluster)
    date = get_date_from_avg_time(hrs)

    participants = get_participants_from_dict(participants_count)

    meeting = {'name': name, 'description': description, 'location': location,
               'participants': participants, 'date': date}
    return meeting


def generate_future_meeting(user_id):
    # fetch all of the user's past meetings for past data
    meetings = db.collection('meetings') \
        .where('participants', 'array_contains', user_id) \
        .order_by('date', 'DESCENDING') \
        .limit(50)
    docs = meetings.stream()

    # create centroids, split meetings to clusters, generate new meeting with probability
    # check for patterns

    meetings = []
    for doc in docs:  # convert stream to list
        meetings.append(doc.to_dict())

    if not meetings:  # check if meetings exist
        return None, None

    # dividing meetings into clusters, EPOCH times
    chosen_clusters = None
    for i in range(EPOCHS):
        random.shuffle(meetings)  # shuffle list for randomness
        centroids = {}
        centroid_count = 0
        for meeting in meetings:  # for each meeting, deciding which cluster it goes into
            if not centroids:  # if empty, create the first centroid
                centroids[centroid_count] = {'centroid': meeting, 'cluster': [meeting]}
                centroid_count += 1
                continue
            closest_centroid = None
            highest_score = 0
            for key in centroids:  # find closest centroid
                score = meeting_similarity(meeting, centroids[key]['centroid'])  # get score from similarity func
                if score > highest_score:
                    highest_score = score
                    closest_centroid = key
            if highest_score > NEW_CENTROID_THRESHOLD:  # if score is high enough to enter a cluster, add to cluster
                centroids[closest_centroid]['cluster'].append(meeting)
            else:  # if meeting is not similar enough to any centroid, create new centroid
                centroids[centroid_count] = {'centroid': meeting, 'cluster': [meeting]}
                centroid_count += 1
        if chosen_clusters is None:
            chosen_clusters = centroids.copy()
            continue
        # after each run, we want to choose the run with the least centroids - more accurate data
        if len(centroids) < len(chosen_clusters):
            chosen_clusters = centroids.copy()

    # choose the mose relevant cluster to create a meeting from, timing wise
    highest_score = 0
    chosen_cluster = None
    for key in chosen_clusters:
        # calculate the avg timing of each cluster
        chosen_clusters[key]['timing_data'] = calculate_avg_timing(chosen_clusters[key]['cluster'])
        # give a score to the cluster based on how relevant it is to present time
        score = calculate_score_from_timing_data(chosen_clusters[key]['timing_data'])
        print(key, score)
        if score > highest_score:
            highest_score = score
            chosen_cluster = key
    print('chosen:', chosen_cluster)

    # generate new meeting from chosen cluster
    if chosen_cluster is None:
        return 0, 0
    cluster = chosen_clusters[chosen_cluster]['cluster']
    meeting = generate_meeting_from_cluster(cluster)
    return meeting, highest_score


def generate_birthday_meeting(user_id):
    # create a meeting from upcoming birthdays
    users = db.collection('users').where('phone', '==', user_id)
    docs = users.stream()
    # iterating on all of the user's birthdays
    for doc in docs:
        birthdays = doc.to_dict()['birthdays']
        for birthday in birthdays:
            date_string = birthday.split(',')[1]
            date = datetime.datetime.strptime(date_string[:-8], '%Y-%m-%dT%H:%M')
            event_name = birthday.split(',')[0]

            time_delta = datetime.datetime.now() - date
            # if the birthday is near, creating the birthday meeting
            if 5 >= time_delta.days >= 4:
                meeting_name = event_name
                meeting_desc = 'Birthday party!'
                meeting_location = 'Where?'
                meeting_date = {'year': date.year, 'month': date.month, 'day': date.day,
                                'hours': date.hour, 'mins': date.minute}
                meeting_participants = [user_id]
                meeting = {'name': meeting_name, 'description': meeting_desc, 'location': meeting_location,
                           'participants': meeting_participants, 'date': meeting_date}
                return meeting
    return None


def test():
    # print(generate_meeting_from_location('1234', {'name': 'burger', 'address': 'park hamada'}))
    # x = '{%22name%22:%22bbb%20b%22,%22address%22:%22zibi%22,%22tags%22:[%22home%22,%22restaurant%22,%22burgers%22]}'
    # unquoted = urllib.parse.unquote(x)
    # y = json.loads(unquoted)
    # print(y)
    # print()
    # time='2021-10-11T04:00'
    # date = datetime.datetime.strptime(time, '%Y-%m-%dT%H:%M')
    # print(date)
    # generate_birthday_meeting('1234')
    # remind_users()
    print(spacy_similarity('beach', 'sea'))


def suggest_for_all():
    users = db.collection('users').stream()
    for user in users:
        usr = user.to_dict()
        user_id = usr['phone']
        # suggest if there is an upcoming birthday
        birthday_meeting = generate_birthday_meeting(user_id)  # check for upcoming birthday event
        if birthday_meeting is not None:
            try:
                response = PushClient().publish(
                    PushMessage(to=usr['notificationToken'],
                                title='Meeting Suggestion',
                                body='Moti has a birthday meeting suggestion for you, click here to view',
                                data={'kind': 'suggest', 'meeting': birthday_meeting}))
            except Exception as e:
                print(e)

        # generate a meeting
        meeting, score = generate_future_meeting(user_id)
        if meeting is not None and score > SCORE_THRESHOLD:  # if the meeting is good enough, send notif to user
            print(score, meeting)
            try:
                response = PushClient().publish(
                    PushMessage(to=usr['notificationToken'],
                                title='Meeting Suggestion',
                                body='Moti has a meeting suggestion for you, click here to view',
                                data={'kind': 'suggest', 'meeting': meeting}))
            except Exception as e:
                print(e)


def remind_users():
    # reminding users about meetings that take place 3 hours from now
    print('remind_users')
    users = db.collection('users')
    now = datetime.datetime.now()
    meetings = db.collection('meetings') \
        .where('date', '>', now) \
        .order_by('date', 'DESCENDING')
    docs = meetings.stream()
    # getting all meetings
    for doc in docs:
        meeting = doc.to_dict()
        d = meeting['date']
        meeting_date = datetime.datetime(d.year, d.month, d.day, d.hour, d.minute)
        delta = datetime.timedelta(hours=3)
        # if the meeting is now within the next 3 hours, it's not relevant
        if meeting_date - now >= delta:
            continue
        # creating the push notification to all of the meeting's participants
        meeting_name = meeting['name']
        meeting_desc = meeting['description']
        meeting_location = meeting['location']
        meeting_date = {'year': d.year, 'month': d.month, 'day': d.day,
                        'hours': d.hour, 'mins': d.minute}
        meeting_participants = meeting['participants']
        meeting2 = {'name': meeting_name, 'description': meeting_desc, 'location': meeting_location,
                    'participants': meeting_participants, 'date': meeting_date}
        participants = meeting['participants']
        part = users.where('phone', 'in', participants)
        part2 = part.stream()
        for participant in part2:
            p = participant.to_dict()
            notif_token = p['notificationToken']
            if notif_token is not None:
                try:
                    response = PushClient().publish(
                        PushMessage(to=notif_token,
                                    title='Meeting Reminder',
                                    body='You have a meeting soon! Click to view!',
                                    data={'kind': 'suggest', 'meeting': meeting2}))
                except Exception as e:
                    print(e)


def auto_suggest():
    schedule.every().day.at("17:29").do(suggest_for_all)
    schedule.every().hour.do(remind_users)
    while True:
        schedule.run_pending()
        time.sleep(60)


def scrap_meeting(thing, area, details):
    deme = False

    if deme:
        # test = [{'name': 'פיקאפ בורגר', 'address': 'Jabotinski St 1, Lod, Israel', 'tags': ['restaurant', 'food']}, {'name': 'המבורגר - פיקאפ בורגר - PICKUP BURGER', 'address': 'Jabotinski St 1, Lod, 7138702, Israel', 'tags': ['restaurant', 'food']}, {'name': 'Burgeranch', 'address': 'רמלוד, Tsofit St 40, Ramla, Israel', 'tags': ['restaurant', 'food']}, {'name': 'Q Burger', 'address': 'Sderot Tsahal 28, Lod, Israel', 'tags': ['restaurant', 'food']}, {'name': 'Mike Burger', 'address': 'Weizman St 22, Ness Ziona, 7403019, Israel', 'tags': ['restaurant', 'food']}, {'name': 'בורגר סטורי - Burger story', 'address': 'Rothschild St 64, Rishon LeTsiyon, 7522304, Israel', 'tags': ['restaurant', 'food']}, {'name': 'Dirty Burger', 'address': 'King George St 30, Tel Aviv-Yafo, Israel', 'tags': ['restaurant', 'food']}, {'name': 'Burgus', 'address': 'Moshe Beker St 9, Rishon LeTsiyon, Israel', 'tags': ['restaurant', 'food']}, {'name': 'Magic Burger', 'address': 'Shlomo Ibn Gabirol St 64, Tel Aviv-Yafo, Israel', 'tags': ['restaurant', 'food']}, {'name': 'מייק בורגר', 'address': 'Sderot Herzl 43, Ramla, Israel', 'tags': ['restaurant', 'food']}, {'name': 'Burger Saloon', 'address': 'Derech Moshe Dayan 3, Yehud-Monosson, Israel', 'tags': ['restaurant', 'food']}, {'name': 'Burger Saloon', 'address': 'תחנת דלק פז, Derech HaMaccabim 67, Rishon LeTsiyon, Israel', 'tags': ['restaurant', 'food']}, {'name': 'Z Burger', 'address': 'Arye Shenkar St 46, Holon, Israel', 'tags': ['restaurant', 'food']}, {'name': 'Hamosad', 'address': 'Shlomo Ibn Gabirol St 67, Tel Aviv-Yafo, Israel', 'tags': ['restaurant', 'food']}, {'name': 'Port 19 Shlomo HaMelekh', 'address': 'Shlomo HaMelekh St 2, Tel Aviv-Yafo, Israel', 'tags': ['restaurant', 'food']}, {'name': 'Man Burger', 'address': 'Tirzah St 19, Ramat Gan, Israel', 'tags': ['restaurant', 'food']}, {'name': 'Memphis ממפיס תל אביב | המבורגר פרימיום כשר', 'address': 'Carlebach St 20, Tel Aviv-Yafo, 6473005, Israel', 'tags': ['meal_takeaway', 'restaurant', 'food']}, {'name': 'King David Burger', 'address': 'Jabotinsky St 16, Rishon LeTsiyon, Israel', 'tags': ['restaurant', 'food']}, {'name': 'BURGER STATION בורגר סטיישן', 'address': 'Bialik St 12, Ramat Gan, 5245106, Israel', 'tags': ['restaurant', 'food']}, {'name': 'The Garage', 'address': 'Herzl St 151, Rishon LeTsiyon, Israel', 'tags': ['restaurant', 'food']}]
        # return test
        sushi_tel_aviv = [{'name': 'Sushi Bar Bazel', 'address': 'Frishman St 20, Tel Aviv-Yafo, Israel',
                           'tags': ['meal_delivery', 'restaurant', 'food']},
                          {'name': 'Fu Sushi', 'address': 'Dizengoff St 302, Tel Aviv-Yafo, Israel',
                           'tags': ['restaurant', 'food']},
                          {'name': 'TYO', 'address': 'Shabazi St 58, Tel Aviv-Yafo, 6514431, Israel',
                           'tags': ['restaurant', 'food']},
                          {'name': 'JASIA', 'address': 'Louis Pasteur St 7, Tel Aviv-Yafo, 6803608, Israel',
                           'tags': ['bar', 'restaurant', 'food']},
                          {'name': 'Moon', 'address': 'Bograshov St 58, Tel Aviv-Yafo, Israel',
                           'tags': ['restaurant', 'food']}, {'name': 'THE GREEN ROLL Vegan Sushi Bar',
                                                             'address': 'Montefiore St 30, Tel Aviv-Yafo, Israel',
                                                             'tags': ['restaurant', 'food']},
                          {'name': 'Onami', 'address': "HaArba'a St 18, Tel Aviv-Yafo, Israel",
                           'tags': ['restaurant', 'food']},
                          {'name': 'Ze Sushi', 'address': 'Arania Osvaldo St 17, Tel Aviv-Yafo, Israel',
                           'tags': ['restaurant', 'food']},
                          {'name': 'Nini Hachi', 'address': 'Ben Yehuda St 228, Tel Aviv-Yafo, Israel',
                           'tags': ['restaurant', 'food']},
                          {'name': 'Ze Sushi', 'address': 'Ashtori HaFarhi St 14, Tel Aviv-Yafo, Israel',
                           'tags': ['restaurant', 'food']},
                          {'name': 'Atza Sushi Bar', 'address': 'Ben Yehuda St 128, Tel Aviv-Yafo, Israel',
                           'tags': ['restaurant', 'food']},
                          {'name': 'Yakimono', 'address': 'HaYarkon St 205, Tel Aviv-Yafo, Israel',
                           'tags': ['restaurant', 'food']}]
        test40 = [{'name': 'פיקאפ בורגר', 'address': 'Jabotinski St 1, Lod, Israel', 'tags': ['restaurant', 'food']},
                  {'name': 'פיקאפ בורגר', 'address': 'Jabotinski St 1, Lod, Israel', 'tags': ['restaurant', 'food']},
                  {'name': 'פיקאפ בורגר', 'address': 'Jabotinski St 1, Lod, Israel', 'tags': ['restaurant', 'food']},
                  {'name': 'פיקאפ בורגר', 'address': 'Jabotinski St 1, Lod, Israel', 'tags': ['restaurant', 'food']},
                  {'name': 'פיקאפ בורגר', 'address': 'Jabotinski St 1, Lod, Israel', 'tags': ['restaurant', 'food']},
                  {'name': 'פיקאפ בורגר', 'address': 'Jabotinski St 1, Lod, Israel', 'tags': ['restaurant', 'food']},
                  {'name': 'פיקאפ בורגר', 'address': 'Jabotinski St 1, Lod, Israel', 'tags': ['restaurant', 'food']},
                  {'name': 'פיקאפ בורגר', 'address': 'Jabotinski St 1, Lod, Israel', 'tags': ['restaurant', 'food']},
                  {'name': 'פיקאפ בורגר', 'address': 'Jabotinski St 1, Lod, Israel', 'tags': ['restaurant', 'food']},
                  {'name': 'פיקאפ בורגר', 'address': 'Jabotinski St 1, Lod, Israel', 'tags': ['restaurant', 'food']},
                  {'name': 'פיקאפ בורגר', 'address': 'Jabotinski St 1, Lod, Israel', 'tags': ['restaurant', 'food']},
                  {'name': 'פיקאפ בורגר', 'address': 'Jabotinski St 1, Lod, Israel', 'tags': ['restaurant', 'food']},
                  {'name': 'פיקאפ בורגר', 'address': 'Jabotinski St 1, Lod, Israel', 'tags': ['restaurant', 'food']},
                  {'name': 'פיקאפ בורגר', 'address': 'Jabotinski St 1, Lod, Israel', 'tags': ['restaurant', 'food']},
                  {'name': 'פיקאפ בורגר', 'address': 'Jabotinski St 1, Lod, Israel', 'tags': ['restaurant', 'food']},
                  {'name': 'פיקאפ בורגר', 'address': 'Jabotinski St 1, Lod, Israel', 'tags': ['restaurant', 'food']},
                  {'name': 'פיקאפ בורגר', 'address': 'Jabotinski St 1, Lod, Israel', 'tags': ['restaurant', 'food']},
                  {'name': 'פיקאפ בורגר', 'address': 'Jabotinski St 1, Lod, Israel', 'tags': ['restaurant', 'food']},
                  {'name': 'פיקאפ בורגר', 'address': 'Jabotinski St 1, Lod, Israel', 'tags': ['restaurant', 'food']},
                  {'name': 'פיקאפ בורגר', 'address': 'Jabotinski St 1, Lod, Israel', 'tags': ['restaurant', 'food']},
                  {'name': 'פיקאפ בורגר', 'address': 'Jabotinski St 1, Lod, Israel', 'tags': ['restaurant', 'food']},
                  {'name': 'פיקאפ בורגר', 'address': 'Jabotinski St 1, Lod, Israel', 'tags': ['restaurant', 'food']},
                  {'name': 'פיקאפ בורגר', 'address': 'Jabotinski St 1, Lod, Israel', 'tags': ['restaurant', 'food']},
                  {'name': 'פיקאפ בורגר', 'address': 'Jabotinski St 1, Lod, Israel', 'tags': ['restaurant', 'food']},
                  {'name': 'פיקאפ בורגר', 'address': 'Jabotinski St 1, Lod, Israel', 'tags': ['restaurant', 'food']},
                  {'name': 'פיקאפ בורגר', 'address': 'Jabotinski St 1, Lod, Israel', 'tags': ['restaurant', 'food']},
                  {'name': 'פיקאפ בורגר', 'address': 'Jabotinski St 1, Lod, Israel', 'tags': ['restaurant', 'food']},
                  {'name': 'פיקאפ בורגר', 'address': 'Jabotinski St 1, Lod, Israel', 'tags': ['restaurant', 'food']},
                  {'name': 'פיקאפ בורגר', 'address': 'Jabotinski St 1, Lod, Israel', 'tags': ['restaurant', 'food']},
                  {'name': 'פיקאפ בורגר', 'address': 'Jabotinski St 1, Lod, Israel', 'tags': ['restaurant', 'food']},
                  {'name': 'פיקאפ בורגר', 'address': 'Jabotinski St 1, Lod, Israel', 'tags': ['restaurant', 'food']},
                  {'name': 'פיקאפ בורגר', 'address': 'Jabotinski St 1, Lod, Israel', 'tags': ['restaurant', 'food']},
                  {'name': 'פיקאפ בורגר', 'address': 'Jabotinski St 1, Lod, Israel', 'tags': ['restaurant', 'food']},
                  {'name': 'פיקאפ בורגר', 'address': 'Jabotinski St 1, Lod, Israel', 'tags': ['restaurant', 'food']},
                  {'name': 'פיקאפ בורגר', 'address': 'Jabotinski St 1, Lod, Israel', 'tags': ['restaurant', 'food']},
                  {'name': 'פיקאפ בורגר', 'address': 'Jabotinski St 1, Lod, Israel', 'tags': ['restaurant', 'food']},
                  {'name': 'פיקאפ בורגר', 'address': 'Jabotinski St 1, Lod, Israel', 'tags': ['restaurant', 'food']},
                  {'name': 'פיקאפ בורגר', 'address': 'Jabotinski St 1, Lod, Israel', 'tags': ['restaurant', 'food']},
                  {'name': 'פיקאפ בורגר', 'address': 'Jabotinski St 1, Lod, Israel', 'tags': ['restaurant', 'food']},
                  {'name': 'פיקאפ בורגר', 'address': 'Jabotinski St 1, Lod, Israel', 'tags': ['restaurant', 'food']}]
        test20 = [{'name': 'פיקאפ בורגר', 'address': 'Jabotinski St 1, Lod, Israel', 'tags': ['restaurant', 'food']},
                  {'name': 'המבורגר - פיקאפ בורגר - PICKUP BURGER', 'address': 'Jabotinski St 1, Lod, 7138702, Israel',
                   'tags': ['restaurant', 'food']},
                  {'name': 'Burgeranch', 'address': 'רמלוד, Tsofit St 40, Ramla, Israel',
                   'tags': ['restaurant', 'food']},
                  {'name': 'Q Burger', 'address': 'Sderot Tsahal 28, Lod, Israel', 'tags': ['restaurant', 'food']},
                  {'name': 'Mike Burger', 'address': 'Weizman St 22, Ness Ziona, 7403019, Israel',
                   'tags': ['restaurant', 'food']}, {'name': 'בורגר סטורי - Burger story',
                                                     'address': 'Rothschild St 64, Rishon LeTsiyon, 7522304, Israel',
                                                     'tags': ['restaurant', 'food']},
                  {'name': 'Dirty Burger', 'address': 'King George St 30, Tel Aviv-Yafo, Israel',
                   'tags': ['restaurant', 'food']},
                  {'name': 'Burgus', 'address': 'Moshe Beker St 9, Rishon LeTsiyon, Israel',
                   'tags': ['restaurant', 'food']},
                  {'name': 'Magic Burger', 'address': 'Shlomo Ibn Gabirol St 64, Tel Aviv-Yafo, Israel',
                   'tags': ['restaurant', 'food']},
                  {'name': 'מייק בורגר', 'address': 'Sderot Herzl 43, Ramla, Israel', 'tags': ['restaurant', 'food']},
                  {'name': 'Burger Saloon', 'address': 'Derech Moshe Dayan 3, Yehud-Monosson, Israel',
                   'tags': ['restaurant', 'food']},
                  {'name': 'Burger Saloon', 'address': 'תחנת דלק פז, Derech HaMaccabim 67, Rishon LeTsiyon, Israel',
                   'tags': ['restaurant', 'food']},
                  {'name': 'Z Burger', 'address': 'Arye Shenkar St 46, Holon, Israel', 'tags': ['restaurant', 'food']},
                  {'name': 'Hamosad', 'address': 'Shlomo Ibn Gabirol St 67, Tel Aviv-Yafo, Israel',
                   'tags': ['restaurant', 'food']},
                  {'name': 'Port 19 Shlomo HaMelekh', 'address': 'Shlomo HaMelekh St 2, Tel Aviv-Yafo, Israel',
                   'tags': ['restaurant', 'food']},
                  {'name': 'Man Burger', 'address': 'Tirzah St 19, Ramat Gan, Israel', 'tags': ['restaurant', 'food']},
                  {'name': 'Memphis ממפיס תל אביב | המבורגר פרימיום כשר',
                   'address': 'Carlebach St 20, Tel Aviv-Yafo, 6473005, Israel',
                   'tags': ['meal_takeaway', 'restaurant', 'food']},
                  {'name': 'King David Burger', 'address': 'Jabotinsky St 16, Rishon LeTsiyon, Israel',
                   'tags': ['restaurant', 'food']},
                  {'name': 'BURGER STATION בורגר סטיישן', 'address': 'Bialik St 12, Ramat Gan, 5245106, Israel',
                   'tags': ['restaurant', 'food']},
                  {'name': 'The Garage', 'address': 'Herzl St 151, Rishon LeTsiyon, Israel',
                   'tags': ['restaurant', 'food']}]
        return sushi_tel_aviv
    else:
        # creating a query to send to google
        url = 'https://maps.googleapis.com/maps/api/place/textsearch/json' \
              '?query=' + thing + '+in+' + area + '+' + details + '' \
                                                                  '&key=' + TOILET_PAPER
        response = requests.get(url)
        if not response.ok:
            return None
        results = json.loads(response.text)['results']
        small_results = []
        num_of_results = 0
        # cleaning up the returned data
        for result in results:
            tags = [x for x in result['types'] if x not in ['establishment', 'point_of_interest']]
            small_results.append({'name': result['name'], 'address': result['formatted_address'], 'tags': tags})
            num_of_results += 1
            if num_of_results == 12:
                break
        print(small_results)
        return small_results


def generate_meeting_from_location(user_id, location):
    # fetch past user's meeting
    meetings = db.collection('meetings') \
        .where('participants', 'array_contains', user_id) \
        .order_by('date', 'DESCENDING') \
        .limit(50)
    docs = meetings.stream()

    meetings = []
    for doc in docs:  # convert stream to list
        meetings.append(doc.to_dict())

    if not meetings:  # check if meetings exist
        return None

    location_name = location['name']
    location_address = location['address']
    highest_score = 0
    top_meet = None
    # from all past meetings, which meeting is similar to our desired location
    for meeting in meetings:
        score = max(spacy_similarity(location_name, meeting['location']),
                    spacy_similarity(location_name, meeting['name']))
        if score > highest_score:
            highest_score = score
            top_meet = meeting

    name = location['name']
    participants = []
    location2 = location['address']
    desc = ''
    date2 = datetime.datetime.now() + datetime.timedelta(hours=24)
    date = {'year': date2.year, 'month': date2.month, 'day': date2.day,
            'hours': date2.hour, 'mins': date2.minute}
    # taking the participants from the most similar meeting
    if top_meet is not None:
        participants = top_meet['participants']
        desc = top_meet['description']

    if not participants:
        participants.append(user_id)

    meeting = {'name': name, 'description': desc, 'location': location2, 'participants': participants, 'date': date}
    return meeting


class S(BaseHTTPRequestHandler):
    # Setting success headers
    def _set_headers(self):
        self.send_response(200)
        self.send_header("Content-type", "application/json")
        self.end_headers()

    # Setting failure headers
    def _set_bad_headers(self):
        self.send_response(201)
        self.send_header("Content-type", "application/json")
        self.end_headers()

    def do_GET(self):
        url = urlparse(self.path)
        parameters = url.query
        if parameters != '':
            parameters = parameters.split("&")
            params = {}
            for param in parameters:
                x = param.split("=")
                params[x[0]] = x[1]
            # print(params)

        # Empty url
        if url.path == '/':
            self.wfile.write(b"Yo Yo my man what's poppin'! This is the MOTI server")

        # Generate a meeting
        if url.path == '/generate_meeting':
            user_id = params['id']
            x, score = generate_future_meeting(user_id)
            if x is None:
                self._set_bad_headers()
                self.wfile.write(json.dumps({'error': 'error'}).encode())
            else:
                self._set_headers()
                self.wfile.write(json.dumps(x).encode())

        # Look for a place
        if url.path == '/scrap_meeting':
            thing = params['thing']
            area = params['area']
            details = params['details']
            x = scrap_meeting(thing, area, details)
            if x is None:
                self._set_bad_headers()
                self.wfile.write(json.dumps({'error': 'error'}).encode())
            else:
                self._set_headers()
                ret = json.dumps(x).encode()
                print(ret)
                self.wfile.write(ret)

        # Generate a meeting after choosing a place
        if url.path == '/scrap_meeting2':
            user_id = params['id']
            unquoted = urllib.parse.unquote(params['location'])
            chosen_location = json.loads(unquoted)
            x = generate_meeting_from_location(user_id, chosen_location)
            if x is None:
                self._set_bad_headers()
                self.wfile.write(json.dumps({'error': 'error'}).encode())
            else:
                self._set_headers()
                self.wfile.write(json.dumps(x).encode())

    def do_HEAD(self):
        self._set_headers()

    def do_POST(self):
        # Doesn't do anything with posted data
        self._set_headers()
        self.wfile.write(self._html("POST!"))


def run(server_class=HTTPServer, handler_class=S, addr="localhost", port=8000):
    # Running a sever of type S, all server actions are implemented in class S
    server_address = (addr, port)
    httpd = server_class(server_address, handler_class)

    print(f"Starting httpd server on {addr}:{port}")
    httpd.serve_forever()


if __name__ == "__main__":
    k = 11
    if k == 1:
        test()
    else:
        # Starting a continuous thread that auto suggests meetings
        thread = Thread(target=auto_suggest)
        thread.start()

        parser = argparse.ArgumentParser(description="Run a simple HTTP server")
        parser.add_argument(
            "-l",
            "--listen",
            default="0.0.0.0",
            help="Specify the IP address on which the server listens",
        )
        parser.add_argument(
            "-p",
            "--port",
            type=int,
            default=8082,
            help="Specify the port on which the server listens",
        )
        args = parser.parse_args()
        # Opening and Running python HTTP server
        run(addr=args.listen, port=args.port)
