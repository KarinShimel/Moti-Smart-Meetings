import React, {useEffect, useState} from 'react';
import {StatusBar} from 'expo-status-bar';
import {
    StyleSheet,
    Platform,
    Dimensions,
    Text,
    TouchableHighlight,
    TouchableOpacity,
    View,
    SafeAreaView,
    Image,
    Button,
    Alert,
    StatusBarIOS,
    LogBox, BackHandler, DatePickerAndroid, VirtualizedList, ImageBackground
} from 'react-native';
import "firebase/firestore";
import * as Contacts from 'expo-contacts';
import firebase from "firebase";
import resets from "react-native-web/dist/exports/StyleSheet/initialRules";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import {Audio} from "expo-av";

let {height, width} = Dimensions.get("window");
const y = height
const x = width

// Initialize Firebase
const firebaseConfig = Constants.manifest.extra.firebaseConfig
if (firebase.apps.length === 0) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();
const usersCollection = db.collection('users')
const meetings = db.collection('meetings')


async function createMeeting(navigation, id, name, desc, date, location, participants, fromSuggest) {
    let p = []
    participants.forEach(x => {
        p.push(x['id'])
    })
    //console.log("this is p-\n", p, "\n")
    const yr = 2000 + (parseInt(date['year']) % 100)
    const date2 = new Date(yr, date['month'], date['day'], date['hours'], date['mins'])
    await meetings.add({
        name: name, date: firebase.firestore.Timestamp.fromDate(date2), location: location, description: desc
        , participants: p
    }).then(docRef => {
        meetings.doc(docRef.id).get().then(doc => {
            participants.forEach(x => {
                if (x['id'] !== id) {
                    sendPushNotification(x['notifToken'], doc.data()).then();
                }
            })
        })
        Alert.alert('Success', 'Meeting Created')
    })
    if (fromSuggest) {
        navigation.pop(3)
    } else {

        navigation.pop(4)
    }

}

async function updateMeeting(navigation, id, name, desc, date, location, participants) {
    let updatedPar = []
    //console.log("Participants - \n")
    participants.forEach(x => {
        if (x['id'] !== undefined)
            updatedPar.push(x['id'])
    })
    //console.log("this is updatedPar-\n", updatedPar)
    const yr = 2000 + (parseInt(date['year']) % 100)
    const date2 = new Date(yr, date['month'] - 1, date['day'], date['hours'], date['mins'])
    await meetings.doc(id).get().then(doc => {

        meetings.doc(doc.id).update({
            name: name, date: firebase.firestore.Timestamp.fromDate(date2), location: location, description: desc
            , participants: updatedPar
        }).then(result => {
            participants.forEach(x => {
                //console.log(x['notifToken'])
                sendPushNotification(x['notifToken'], doc.data()).then();
            })
        })

    })
    navigation.pop(2)
}

//  ------------------------------------
//  Hello MEKOTETIM!!!
//  Kora here, If you want to navigate to this page from another, please add another param
//  in the navigation command. See example (which is from Create3Location screen):
//  navigation.navigate('Create4',{id:id,name:name,desc:desc,date:date,location:location,participants:null,
//     prev_screen: route.name}) ------ THIS LINE IS THE LINE WITH THE CHANGE
//     ------------------------------------


// TODO: Issue with item image from firebase


async function sendPushNotification(expoPushToken, meeting) {
    const message = {
        to: expoPushToken,
        sound: 'default',
        title: 'Meeting Invitation',
        body: 'You were added to a meeting, click here to view',
        data: {kind: 'inv', meeting: meeting},
    };

    await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Accept-encoding': 'gzip, deflate',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
    });
}

function addParticipant(name, id, notifToken) {
    const filter = Participants.filter(p => p['id']===id)
    if (filter.length === 0){
        Participants.push({name: name, id: id, notifToken: notifToken})
    }
    console.log("ADDED ", id)
}

let Participants = []

const getItem = (data, index) => (
    {
        name: data[index]['name'],
        id: data[index]['id'],
        url: data[index]['url']
    });

const getItemCount = (data) => data.length;

let counter = 0

function getKey() {
    counter += 1
    return counter.toString()
}

let firstRender = true

function turnToInternationalNumbers(numbers) {
    let res = []
    numbers.forEach(number => {
        if (number.slice(0, 3) === '972') {
            res.push('+' + number)
        }
        if (number.slice(0, 4) === '+972') {
            res.push(number)
        }
        if (number.slice(0, 2) === '05') {
            res.push('+972' + number.slice(1))
        }
        if (number === '1234' || number === '1235' || number === '1236') {
            res.push(number)
        }
    })
    return res
}

const Create4Participants = ({navigation, route}) => {

    const Item = ({name, id, url}) => (
        <View style={{
            flexDirection: 'row',
            backgroundColor: "#FFFFFF50",
            height: height / 8,
            width: 0.9 * width,
            alignItems: "center",
            justifyContent: "center",
            margin: 10,
            borderRadius: 20,
            borderWidth: 1,
            overflow: "hidden",
            borderColor:'white'
        }}>
            <View style={{width: height / 7, justifyContent: "center"}}>
            </View>
            <Text style={{fontSize: 24, flex: 0.9, marginLeft: 15, textAlignVertical: 'center'}}>{name}</Text>
            <TouchableOpacity onPress={() => {
                deleteParticipant(id)
            }}
                              style={{justifyContent: "center"}}>
                <Image source={require('../assets/close.png')}
                       style={{height: 25, width: 25,marginRight:10, tintColor: 'rgba(223,34,119,1)'}}
                />
            </TouchableOpacity>
        </View>
    );

    function deleteParticipant(id) {
            Participants = Participants.filter(x => x['id'] != id)
            setRender(render + 1)
        //niga
        // eldad
    }

    const [prevScreen, setPrevScreen] = useState(route.params.prev_screen)
    //console.log("Hey im create contact. I came from -", prevScreen, route.params.id)
    const [name, setName] = useState(route.params.name);
    const [desc, setDesc] = useState(route.params.desc);
    const [id, setId] = useState(route.params.id);
    const [date, setDate] = useState(route.params.date);
    const [location, setLocation] = useState(route.params.location);
    const [fromContacts, setFromContacts] = useState(null);
    const [render, setRender] = useState(1);
    const [participantsFromSuggest, setParticipantsFromSuggest] = useState(route.params.participants);

    if (firstRender) {
        const {status} = Contacts.requestPermissionsAsync().then()
        addParticipant('Me', id, null)
        if (participantsFromSuggest != null) { // if came from suggest page, insert par. to list
            const contactsToAdd = turnToInternationalNumbers(participantsFromSuggest)
            if (contactsToAdd.length !== participantsFromSuggest.length) {
                alert('One or more of your contacts numbers is invalid')
            }
            let counter = 0

            usersCollection
                .where('phone', 'in', contactsToAdd).get().then(querySnapshot => {
                querySnapshot.forEach((doc) => {
                    const phone = doc.data()['phone']
                    const notifToken = doc.data()['notificationToken']
                    const name = doc.data()['name']
                    addParticipant(name, phone, notifToken)
                    counter += 1
                })
            })
        }
        firstRender = false
        setRender(render + 1)
    }
    if (fromContacts != null) {
        //delete non existing contacts from fromContacts:
        const contactsToAdd = turnToInternationalNumbers(Object.keys(fromContacts))
        if (contactsToAdd.length !== Object.keys(fromContacts).length) {
            alert('One or more of your contacts numbers is invalid')
        }
        let counter = 0
        usersCollection
            .where('phone', 'in', contactsToAdd).get().then(querySnapshot => {
            querySnapshot.forEach((doc) => {
                const phone = doc.data()['phone']
                const notifToken = doc.data()['notificationToken']
                const name = doc.data()['name']
                addParticipant(name, phone, notifToken)
                counter += 1
            })
            setFromContacts(null)
            if (contactsToAdd.length !== counter) {
                alert('Some of your contacts are not registered to the app')
            }
        })
    }
    // Hiding nav bar
    React.useLayoutEffect(() => {
        navigation.setOptions({headerShown: false});
    }, [navigation]);



    return (
        <ImageBackground source={require('../assets/leaves.jpg')}
                         style={{height: "100%", width: "100%"}}
                         imageStyle={{resizeMode: "cover"}}>
            <View style={{flex: 1,
                backgroundColor: 'rgba(232,255,255,0.85)'}}>
                <StatusBar translucent barStyle={'default'} />
                <View style={{flex: 0.8, alignItems: 'center',}}>
                    <Text style={{textAlign: 'center', fontSize: 26, marginTop: height / 15,
                    color:'white',fontWeight:"bold"}}>Participants</Text>
                    <VirtualizedList
                        data={Participants}
                        initialNumToRender={4}
                        renderItem={({item}) => <Item name={item.name} id={item.id} />}
                        keyExtractor={item => getKey()}
                        getItemCount={getItemCount}
                        getItem={getItem}
                        style={{marginVertical: 10, marginHorizontal: 10, borderRadius: 10, borderWidth: 0.1,
                        borderColor:'white'}}
                    />
                </View>

                <View style={{flex: 0.08, alignItems: 'center', marginBottom: 20}}>
                    <TouchableOpacity style={{
                        borderWidth: 1,
                        height: y * 0.06,
                        width: x * 0.75,
                        textAlign: "center",
                        fontSize: 20,
                        justifyContent: "center",
                        backgroundColor: '#FFFFFF50',
                        borderRadius: 30,borderColor:'white'

                    }}
                              onPress={() => {
                                  navigation.navigate('SelectContacts', {onGoBack: (val) => setFromContacts(val)})
                              }}
                    >
                        <Text style={{textAlign: 'center', fontSize: 24,color:'white'}}>Add From Contacts</Text>
                    </TouchableOpacity>
                </View>

                <View style={{flex: 0.1, alignItems: "center"}}>
                    <TouchableOpacity onPress={() => {
                        firstRender = true
                        const p = JSON.parse(JSON.stringify(Participants))
                        Participants = []
                        let fromSuggest = false
                        // Need to delete this line after checking suggest ref name
                        // --------------------------------------------------------!
                        if (prevScreen.toString()===("Suggest")) {
                            fromSuggest = true
                        }
                        if (prevScreen.toString() === ("Review")) {
                            //("Yes im from review it worked")
                            updateMeeting(navigation, route.params.meeting_id, name, desc, date, location, p)
                        } else {
                            createMeeting(navigation, id, name, desc, date, location, p, fromSuggest)
                        }
                    }}
                                      style={{
                                          borderWidth: 1,
                                          height: y * 0.06,
                                          width: x * 0.75,
                                          textAlign: "center",
                                          fontSize: 20,
                                          justifyContent: "center",
                                          backgroundColor: 'rgba(223,34,119,1)',
                                          borderRadius: 30,borderColor:'white'
                                      }}>
                        <Text style={{textAlign: 'center', fontSize: 24,color:'white'}}>Done</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </ImageBackground>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'rgba(232,255,255,1)'
    },
    item: {
        flexDirection: 'row',
        backgroundColor: "gold",
        height: 0.06 * height,
        width: 0.8 * width,
        marginVertical: 8,
        marginHorizontal: 16,
    }
})

export default Create4Participants;


