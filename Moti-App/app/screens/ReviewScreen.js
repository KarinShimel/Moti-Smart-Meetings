import React, {useEffect, useState} from 'react';
import {
    Alert,
    Dimensions,
    ImageBackground,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import firebase from "firebase";
import {TextInput} from "react-native-gesture-handler";
import Constants from "expo-constants";
import {createEventAsync} from "expo-calendar";
import * as Calendar from 'expo-calendar';

import * as Localization from 'expo-localization';

let {height, width} = Dimensions.get("window");
const y = height;
const x = width
// Initialize Firebase
const firebaseConfig = Constants.manifest.extra.firebaseConfig
if (firebase.apps.length === 0) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();
const usersCollection = db.collection('users')
const meetings = db.collection('meetings')

function dateToString(date) {
    const yr = 2000 + (parseInt(date['year']) % 100)
    const date2 = new Date(yr, date['month'] - 1, date['day'], date['hours'], date['mins'])
    return getTimeFromTimestamp(firebase.firestore.Timestamp.fromDate(date2))
}

function getTimeFromTimestamp(stamp2) {
    if (stamp2 == null) {
        return ''
    }
    const stamp = firebase.firestore.Timestamp.fromMillis(parseInt(stamp2['seconds']) * 1000)
    try {
        const dateList = stamp.toDate().toString().split(' ')
        const day = dateList[0]
        const date = dateList[2] + '-' + dateList[1] + '-' + dateList[3].substring(2, 4)
        const time = dateList[4].substring(0, 5)
        return day + '  ' + date + '  ' + time
    } catch (e) {
        console.log('error parsing time')
    }
}

function getTimeFromTimeSegments(stamp2) {
    if (stamp2 == null) {
        return ''
    }
    const stamp = firebase.firestore.Timestamp.fromMillis(parseInt(stamp2['seconds']) * 1000)
    return [stamp.toDate().getDate(), stamp.toDate().getMonth() + 1, stamp.toDate().getFullYear(),
        stamp.toDate().getHours(), stamp.toDate().getMinutes()]
}

async function updateMeeting(navigation, meeting, name, desc, date, location, participants) {
    const yr = 2000 + (parseInt(date['year']) % 100)
    const date2 = new Date(yr, date['month'] - 1, date['day'], date['hours'], date['mins'])
    await meetings.get().then(querySnapshot => {
        querySnapshot.forEach((doc) => {
            //console.log(doc.id)
            if (doc.id == meeting['id']) {
                meetings.doc(doc.id).update({
                    name: name,
                    date: firebase.firestore.Timestamp.fromDate(date2),
                    location: location,
                    description: desc
                }).then()
            }
        });
    })
    navigation.pop(1)
}

async function deleteMeetFunction(navigation, meeting) {
    await db.collection('meetings').doc(meeting['id']).delete()
    navigation.pop(1)
}

async function getDefaultCalendarSource() {
    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    const defaultCalendars = calendars.filter(each => each.source.name === 'Default');
    return defaultCalendars[0].source;
}


const ReviewScreen = ({navigation, route}) => {
    const meeting = route.params.data
    const [editMode, setEditMode] = useState(false);
    const [users, setUsers] = useState(null);
    const [name, setName] = useState(meeting['name']);
    const [desc, setDesc] = useState(meeting['description']);
    const [date, setDate] = useState((meeting['date']));
    const timeParams = getTimeFromTimeSegments(date)
    const [day, setDay] = useState(timeParams[0]);
    const [month, setMonth] = useState(timeParams[1]);
    const [year, setYear] = useState(timeParams[2]);
    const [hours, setHours] = useState(timeParams[3]);
    const [minutes, setMinutes] = useState(timeParams[4]);

    const [location, setLocation] = useState(meeting['location']);
    const [participants, setParticipants] = useState(meeting['participants']);


    // Hiding nav bar
    React.useLayoutEffect(() => {
        navigation.setOptions({headerShown: false});
    }, [navigation]);


    if (users == null) {
        getParticipants(route.params.data['participants']).then(value => setUsers(value))
    }

    useEffect(() => {
        (async () => {
            const {status} = await Calendar.requestCalendarPermissionsAsync();
            if (status === 'granted') {
                const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
                //console.log('Here are all your calendars:');
                //console.log({calendars});
            }
        })();
    }, []);


    async function getParticipants(p) {
        let res = ''
        const querySnapshot = await usersCollection
            .where('phone', 'in', p).get()
        if (querySnapshot.empty) {
            return -1
        }
        querySnapshot.forEach((doc) => {
            res = res + doc.data()['name'] + ', '
        });
        return res.substring(0, res.length - 2)
    }


    async function addMeetToCalendar(title, startDate) {

        let date = startDate.getDate() //Current Date
        let month = startDate.getMonth(); //Current Month
        let year = startDate.getFullYear(); //Current Year
        let hours = startDate.getHours(); //Current Hours
        let min = startDate.getMinutes(); //Current Minutes
        let sec = startDate.getSeconds(); //Current Seconds

        const {status} = await Calendar.requestCalendarPermissionsAsync();
        let primary = ''
        if (status === 'granted') {
            await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT).then((cals) => {
                cals.forEach((doc) => {
                    if (doc.source.name === "Expo Calendar") {
                        primary = doc.id
                    }
                })
            })
        }
        if (primary === '') {
            const defaultCalendarSource =
                Platform.OS === 'ios'
                    ? await getDefaultCalendarSource()
                    : {isLocalAccount: true, name: 'Expo Calendar'};
            const newCalendarID = await Calendar.createCalendarAsync({
                title: 'Expo Calendar',
                color: 'blue',
                entityType: Calendar.EntityTypes.EVENT,
                sourceId: defaultCalendarSource.id,
                source: defaultCalendarSource,
                name: 'internalCalendarName',
                ownerAccount: 'personal',
                accessLevel: Calendar.CalendarAccessLevel.OWNER,
            });
            primary = newCalendarID
        }

        const newDate = new Date(year, month, date, hours, min, sec)
        const endDate = new Date(year, month, date, (hours + 1) % 12, min, sec)
        await createEventAsync(primary, {
            title: title,
            startDate: newDate,
            endDate: endDate,
            timeZone: "UTC",
            notes:meeting['description'].toString(),
            location:meeting['location'].toString()
        }).then(retID => {
            Alert.alert(
                "Calendar",
                "Meeting Added to Calendar Successfully!",
                [
                    {text: "OK", onPress: () => {
                        }}
                ]
            );
        })
    }
    let nameSizeResize = name.length<38? 0.1 : 0.08
    if (!editMode) {
        return (
            <ImageBackground source={require('../assets/vortex_bg.jpg')}
                             style={{height: "100%", width: "100%"}}
                             imageStyle={{resizeMode: "cover"}}>
                <View style={{...styles.container,paddingHorizontal:3}}>
                    <View style={{flex: 0.8}}>
                        {/*name*/}
                        <View style={{marginTop: 15,}}>
                            <Text style={{
                                textAlign: 'center',
                                fontSize:nameSizeResize*width,
                                color: 'rgba(223,34,119,1)',
                                textTransform: "capitalize",
                                fontWeight: "bold"
                            }}>
                                {name}
                            </Text>
                        </View>
                        {/*desc*/}
                        <View style={{marginTop: 10}}>
                            <Text style={{fontSize: 22, textAlign: 'center'}}>
                                {desc}
                            </Text>
                        </View>
                        {/*location*/}
                        <View style={{marginTop: 30}}>
                            <Text style={{fontSize: 28, textAlign: 'center', color: '#05DFD7', fontWeight: "bold"}}>
                                {location}
                            </Text>
                        </View>
                        {/*date*/}
                        <View style={{marginTop: 6}}>
                            <Text style={{fontSize: 24, textAlign: 'center', color: '#05DFD7', fontWeight: "bold"}}>
                                {date.toDate().getDate()} / {date.toDate().getMonth() + 1} / {date.toDate().getFullYear()}
                            </Text>
                        </View>
                        {/*time*/}
                        <View style={{marginTop: 6}}>
                            <Text style={{fontSize: 24, textAlign: 'center', color: '#05DFD7', fontWeight: "bold"}}>
                                {hours} : {minutes}
                            </Text>
                        </View>
                        {/*participants*/}
                        <View style={{marginTop: 30}}>
                            <Text style={{
                                textAlign: 'center',
                                fontSize: 30,
                                color: 'rgba(223,34,119,1)',
                                textTransform: "capitalize",
                                fontWeight: "bold"
                            }}>
                                Participants:
                            </Text>
                            <Text style={{fontSize: 22, textAlign: 'center', color: '#05DFD7', fontWeight: "bold"}}>

                                {users}
                            </Text>
                        </View>
                    </View>

                    <View style={{flex: 0.5, marginLeft: 10, marginRight: 10}}>
                        <TouchableOpacity onPress={() => {
                            const date2 = Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hours), parseInt(minutes))
                            if (date2 > Date.now()) {
                                setEditMode(true)
                            } else {
                                alert("You cannot edit past meetings")
                            }
                        }}
                                          style={{
                                              borderRadius: 20,
                                              backgroundColor: 'rgba(255,255,255,0.2)',
                                              borderColor: 'rgba(223,34,119,1)',
                                              width: "80%",
                                              height: height / 12,
                                              alignSelf: "center",
                                              justifyContent: "center",
                                              borderWidth: 1
                                          }}>
                            <Text style={{
                                textAlign: 'center',
                                fontSize: 24,
                                color: 'rgba(223,34,119,1)',
                                fontWeight: "bold"
                            }}>Edit</Text>
                        </TouchableOpacity>

                        <TouchableOpacity onPress={() => {
                            ///const cal = await getPermission()
                            // console.log(cal)
                            addMeetToCalendar(meeting['name'], meeting['date'].toDate())
                        }}
                                          style={{
                                              borderRadius: 20,
                                              backgroundColor: 'rgba(255,255,255,0.2)',
                                              borderColor: 'rgba(223,34,119,1)',
                                              width: "80%",
                                              height: height / 12,
                                              alignSelf: "center",
                                              justifyContent: "center",
                                              borderWidth: 1
                                          }}>
                            <Text style={{
                                textAlign: 'center',
                                fontSize: 24,
                                color: 'rgba(223,34,119,1)',
                                fontWeight: "bold"
                            }}>Add To Calendar</Text>
                        </TouchableOpacity>

                        <TouchableOpacity onPress={() => {
                            deleteMeetFunction(navigation, meeting)

                        }}
                                          style={{
                                              borderRadius: 20,
                                              backgroundColor: 'rgba(255,255,255,0.2)',
                                              borderColor: 'rgba(223,34,119,1)',
                                              width: "80%",
                                              height: height / 12,
                                              alignSelf: "center",
                                              justifyContent: "center",
                                              borderWidth: 1
                                          }}>
                            <Text style={{
                                textAlign: 'center',
                                fontSize: 24,
                                color: 'rgba(223,34,119,1)',
                                fontWeight: "bold"
                            }}>Delete The Meet</Text>
                        </TouchableOpacity>

                    </View>
                </View>
            </ImageBackground>
        );
    } else {
        return (
            <ImageBackground source={require('../assets/vortex_bg.jpg')}
                             style={{height: "100%", width: "100%"}}
                             imageStyle={{resizeMode: "cover"}}>
                <View style={styles.container}>
                    <View style={{flex: 0.8}}>
                        <ScrollView contentContainerStyle={{alignItems: 'center', flexGrow: 1}}>
                            {/*name*/}
                            <Text style={{
                                textAlign: 'center',
                                fontSize: 22,
                                marginTop: 10,
                                color: 'rgba(223,34,119,1)',
                                fontWeight: "bold"
                            }}>Name</Text>
                            <TextInput style={styles.editTextBig}
                                       onChangeText={(val) => setName(val)}
                                       defaultValue={name}/>
                            {/*desc*/}
                            <Text style={{
                                textAlign: 'center',
                                fontSize: 22,
                                marginTop: 10,
                                color: 'rgba(223,34,119,1)',
                                fontWeight: "bold"
                            }}>Description</Text>
                            <TextInput style={styles.editTextBig}
                                       onChangeText={(val) => setDesc(val)}
                                       defaultValue={desc}/>
                            {/*location*/}
                            <Text style={{
                                textAlign: 'center',
                                fontSize: 22,
                                marginTop: 10,
                                color: 'rgba(223,34,119,1)',
                                fontWeight: "bold"
                            }}>Location</Text>
                            <TextInput style={styles.editTextBig}
                                       onChangeText={(val) => setLocation(val)}
                                       defaultValue={location}/>
                            {/*date*/}
                            <Text style={{
                                textAlign: 'center',
                                fontSize: 16,
                                marginTop: 10,
                                color: 'rgba(223,34,119,1)',
                                fontWeight: "bold"
                            }}>Date</Text>
                            <View style={{flexDirection: 'row'}}>
                                <TextInput style={styles.editTextSmall}
                                           onChangeText={(val) => setDay(val)}
                                           placeholder={day.toString()}
                                           defaultValue={day.toString()}/>
                                <TextInput style={styles.editTextSmall}
                                           onChangeText={(val) => setMonth(val)}
                                           placeholder={month.toString()}
                                           defaultValue={month.toString()}/>
                                <TextInput style={styles.editTextSmall}
                                           onChangeText={(val) => setYear(val)}
                                           placeholder={year.toString()}
                                           defaultValue={year.toString()}/>
                            </View>

                            <Text style={{
                                textAlign: 'center',
                                fontSize: 16,
                                marginTop: 10,
                                color: 'rgba(223,34,119,1)',
                                fontWeight: "bold"
                            }}>Time</Text>
                            <View style={{flexDirection: 'row'}}>
                                <TextInput style={styles.editTextSmall}
                                           onChangeText={(val) => setHours(val)}
                                           placeholder={hours.toString()}
                                           defaultValue={hours.toString()}/>
                                <TextInput style={styles.editTextSmall}
                                           onChangeText={(val) => setMinutes(val)}
                                           placeholder={minutes.toString()}
                                           defaultValue={minutes.toString()}/>
                            </View>
                            {/*participants*/}
                            <View style={{marginTop: 10}}>
                                <Text style={{
                                    fontSize: 22,
                                    textAlign: 'center',
                                    color: 'rgba(223,34,119,1)',
                                    fontWeight: "bold"
                                }}>
                                    Participants
                                </Text>
                                <TouchableOpacity onPress={() => {
                                    // update date object:
                                    const date2 = {year: year, month: month, day: day, hours: hours, mins: minutes}
                                    navigation.navigate('Create4', {
                                        id: route.params.id,
                                        name: name,
                                        desc: desc,
                                        date: date2,
                                        location: location,
                                        participants: participants,
                                        prev_screen: route.name,
                                        meeting_id: meeting['id']
                                    })
                                }}
                                                  style={{justifyContent: 'center', alignContent: 'center'}}>
                                    <Text style={{textAlign: 'center', fontSize: 22}}>{users}</Text>
                                </TouchableOpacity>
                                {/*<Text style={{fontSize:20, textAlign:'center'}}>*/}
                                {/*    {users}*/}
                                {/*</Text>*/}

                            </View>

                        </ScrollView>

                    </View>

                    <View style={{flex: 0.1, marginLeft: 10, marginRight: 10}}>
                        <TouchableOpacity onPress={() => {
                            const date = firebase.firestore.Timestamp.fromDate
                            (new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hours), parseInt(minutes)))
                            setDate(date)
                            setEditMode(false)
                        }} style={{
                            marginTop: 20,
                            justifyContent: 'center',
                            alignContent: 'center',
                            borderRadius: 20,
                            width: "80%", alignSelf: "center", borderWidth: 1, height: "80%",
                            borderColor: 'rgba(5,223,215,1)'
                        }}>
                            <Text style={{
                                textAlign: 'center',
                                fontSize: 20,
                                color: 'rgba(5,223,215,1)',
                                fontWeight: "bold"
                            }}>Cancel</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={{flex: 0.1, marginTop: 15}}>
                        <TouchableOpacity

                            onPress={() => {
                                const date2 = {year: year, month: month, day: day, hours: hours, mins: minutes}
                                updateMeeting(navigation, meeting, name, desc, date2, location, participants)
                            }}
                            style={{
                                borderRadius: 20,
                                backgroundColor: 'rgba(255,255,255,0.2)',
                                borderColor: 'rgba(223,34,119,1)',
                                width: "80%",
                                height: height / 12,
                                alignSelf: "center",
                                justifyContent: "center",
                                borderWidth: 1
                            }}>
                            <Text style={{
                                textAlign: 'center',
                                fontSize: 24,
                                fontWeight: "bold",
                                color: 'rgba(223,34,119,1)'
                            }}>Done</Text>
                        </TouchableOpacity>
                    </View>

                </View>
            </ImageBackground>
        )
    }
}
const textStyles = StyleSheet.create({
    meetingTitle: {
        fontSize: 30,
        color: "black"
    },
    normalText: {
        fontSize: 24,
        color: "black"
    }
})
const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignContent: "center",
        paddingTop: y / 14,
        backgroundColor: 'rgba(232,255,255,0.9)'
    },
    editTextBig: {
        borderWidth: 1,
        height: y * 0.08,
        width: x * 0.8,
        textAlign: "center",
        fontSize: 20,
        borderRadius: 15,
        backgroundColor: 'rgba(5,223,215,0.15)'
    },
    editTextSmall: {
        borderWidth: 0.2,
        height: y * 0.08,
        width: x * 0.2,
        textAlign: "center",
        fontSize: 20,
        borderRadius: 10,
        backgroundColor: 'rgba(5,223,215,0.15)'
    },
    name: {
        flex: 0.7,
        backgroundColor: "gold",
        justifyContent: "center",
        alignItems: "center"
    },
    status: {
        flex: 0.3,
        backgroundColor: "white",
        justifyContent: "center",
        alignItems: "center"
    },
    timedate: {
        flex: 0.5,
        backgroundColor: "dodgerblue",
        justifyContent: "center",
        alignItems: "center",
    },
    participants: {
        flex: 2,
        backgroundColor: "dodgerblue",
        justifyContent: "center",
        alignItems: "center"
    },
    item: {
        backgroundColor: "gold",
        height: 100,
        justifyContent: 'center',
        alignItems: "center",
        marginVertical: 8,
        marginHorizontal: 16,
        padding: 20,
    },
    title: {
        fontSize: 26,
    }
})
export default ReviewScreen;
