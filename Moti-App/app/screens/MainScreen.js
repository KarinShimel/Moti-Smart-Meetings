import React, {useEffect, useRef, useState} from 'react';
import {StatusBar} from 'expo-status-bar';
import * as Device from 'expo-device';
import {
    StyleSheet,
    Platform,
    Dimensions,
    Text,
    TouchableHighlight,
    TouchableOpacity,
    View,
    SafeAreaView,
    ImageBackground,
    Image,
    Button,
    Alert,
    StatusBarIOS,
    LogBox, BackHandler, Modal, VirtualizedList
} from 'react-native';
import {useDimensions, useDeviceOrientation} from '@react-native-community/hooks';
import {NavigationContainer, useFocusEffect, useRoute} from '@react-navigation/native';
import {createStackNavigator} from '@react-navigation/stack';
import {createEventAsync, getEventsAsync} from "expo-calendar";
import {TextInput} from "react-native-gesture-handler";
import "firebase/firestore";
import async from "async";
import firebase from "firebase/app";
import * as Notifications from "expo-notifications";
import {Notifications as NotificationsOld} from 'expo';
import Constants from "expo-constants";
import {Audio} from "expo-av";
import * as Calendar from "expo-calendar";



let {height, width} = Dimensions.get("window");
const y = height;
const x = width;

// Initialize Firebase
const firebaseConfig = Constants.manifest.extra.firebaseConfig
if (firebase.apps.length === 0) {
    firebase.initializeApp(firebaseConfig);
}

const db = firebase.firestore()
const meetings = db.collection('meetings')
const usersCollection = db.collection('users')

export function getTimeFromTimestamp(stamp) {
    if (stamp == null) {
        return ''
    }
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

function getDayTime(stamp) {
    if (stamp == null) {
        return ''
    }
    try {
        const dateList = stamp.toDate().toString().split(' ')
        const day = dateList[0]
        const date = dateList[2] + '-' + dateList[1] + '-' + dateList[3].substring(2, 4)
        const time = dateList[4].substring(0, 5)
        return {date: date, time: time, day: day}
    } catch (e) {
        console.log('error parsing time')
    }
}

function addMeeting(navigation, id) {
    navigation.navigate('Create1', {id: id})
}

function viewMeetings(navigation, id) {
    navigation.navigate("Meetings", {id: id})
}

function moti(navigation, id) {
    navigation.navigate('Moti', {id: id})
}

function profile(navigation, id) {
    navigation.navigate('Profile', {id: id})
}

async function getNextMeeting(user) {
    // get upcoming meeting from db
    const now = firebase.firestore.Timestamp.now()
    let x
    const querySnapshot = await meetings
        .where('participants', 'array-contains', user)
        .where('date', '>', now)
        .orderBy('date', 'asc').limit(1).get()
    if (querySnapshot.empty) {
        return -1
    }
    querySnapshot.forEach((doc) => {
        x = doc.data();
        x['id'] = doc.id
    });
    return x
}

async function getName(user) {
    let nameIs = ''
    await usersCollection.where('phone', '==', user).get().then(querySnap => {
        if (querySnap.docs.length === 0) {
            nameIs = ''
        } else {
            nameIs = querySnap.docs[0].data()['name'].toString()
        }
    })
    return nameIs
}

function goReviewPage(nav, id, user_id) {
    const meet = DATA.filter(x => x['id']===id)
    if (meet.length>0){
        nav.navigate('Review', {data: meet[0], id:user_id})
    }
}

async function getMeetings(user) {
    //get all meetings of user sorted
    const now = firebase.firestore.Timestamp.now()
    let op = '>'
    await meetings.where('participants', 'array-contains', user)
        .where('date', op, now)
        .orderBy('date', 'asc')
        .get().then(querySnapshot => {
            let counter = 0
            querySnapshot.forEach((doc) => {
                if (counter !== 0) {
                    if(DATA.filter(meeting => meeting['id']===doc.id).length === 0){
                        let x = doc.data()
                        x['id'] = doc.id
                        DATA.push(x)
                    }
                }
                counter++
            })
        })
    return true
}

let DATA = [];

const getItem = (data, index) => ({
    name: data[index]['name'],
    date: getTimeFromTimestamp(data[index]['date']),
    id: data[index]['id']

});

const getItemCount = (data) => data.length;

const Item = ({name, date, id, nav, user_id}) => (
    <View style={{
        height: y / 7,
        width: "80%",
        backgroundColor: '##FFFFFF50',
        borderColor: 'black',
        borderTopWidth: 0.5,
        borderStyle: "solid",
        marginVertical: 5,
        alignSelf: "center"
    }}>
        <TouchableOpacity style={{
            flex: 1, justifyContent: 'center',
            alignItems: "center",alignSelf:"center"
        }} onPress={() => goReviewPage(nav, id, user_id)}>
            <Text style={{...texts.header,textAlign:"center"}}>{name}</Text>
            <Text style={{...texts.normal, color: 'black'}}>
                {date}
            </Text>
        </TouchableOpacity>
    </View>
);

let counter = 0

function getKey() {
    counter += 1
    return counter.toString()
}

let requested = false
const isEmulator = !Device.isDevice

const MainScreen = ({navigation, route}) => {
    const [upcomingData, setUpcomingData] = useState(null)
    const [upcomingMeetings, setUpcomingMeetings] = useState(null)
    const [modalVisible, setModalVisible] = useState(false)
    const [name, setName] = useState('');
    const [modalExecuted, setModalExecuted] = useState(false)
    const [expoPushToken, setExpoPushToken] = useState(null)
    const [getData, setGetData] = useState(false);

    const [nextName, setNextName] = useState('');
    const [nextLoc, setNextLoc] = useState('');
    const [nextMonth, setNextMonth] = useState('');
    const [nextDay, setNextDay] = useState('');
    const [nextHour, setNextHour] = useState('');
    const [nextMin, setNextMin] = useState('');

    // Hiding nav bar
    React.useLayoutEffect(() => {
        navigation.setOptions({headerShown: false});
    }, [navigation]);

    useFocusEffect(
        React.useCallback(() => {
            const onBackPress = () => {
                return true;
            };
            BackHandler.addEventListener("hardwareBackPress", onBackPress);
            return () =>
                BackHandler.removeEventListener("hardwareBackPress", onBackPress);
        }, []));

    React.useEffect(() => {
        navigation.addListener('focus', () => {
            setUpcomingData(null)
            setUpcomingMeetings(null)
            requested = false
        })
        const listener = Notifications.addNotificationResponseReceivedListener(res => {
            //console.log(res)
            const data = res.notification['request']['content']['data'];
            //console.log(data)
            if (data['kind'] === 'inv') {
                navigation.navigate('Review', {data: data['meeting']})

            }
            if (data['kind'] === 'suggest') {
                navigation.navigate('Suggest', {meet: data['meeting']})
            }
        });

        return () => {
            if (listener) {
                listener.remove();
            }
        };
    }, []);

    if (route.params.isNew && !modalExecuted) {
        setModalVisible(true);
        setModalExecuted(true)
    }


    const id = route.params.id
    if (upcomingData == null) {
        getNextMeeting(id).then(doc => {
            if (doc !== -1) {
                setUpcomingData(doc)
                setNextName(doc['name'])
                setNextLoc(doc['location'])
                const date = doc['date'].toDate()
                setNextMonth(date.getMonth()+1)
                setNextDay(date.getDate())
                setNextHour(date.getHours())
                setNextMin(date.getMinutes())
            } else {
                setUpcomingData(null)
                setNextName('No Upcoming Meeting')
                setNextLoc('')
                setNextMonth('')
                setNextDay('')
                setNextHour('')
                setNextMin('')
            }
        })
    }
    if (upcomingMeetings == null && requested === false) {
        requested = true
        DATA = []
        counter = 0
        getMeetings(id).then(ret => {
            setUpcomingMeetings(ret)
        })
    }
    if (name === '') {
        getName(route.params.id).then(val => {
            setName(val)
        })
    }


    return (
    <ImageBackground source={require('../assets/leaf.jpg')}
                     style={{height: "100%", width: "100%"}}
                     imageStyle={{resizeMode: "cover"}}>
        <View style={styles.container}>
            <StatusBar translucent barStyle={'default'} />
            <Modal
                animationType="slide"
                transparent={true}
                visible={modalVisible}
                onRequestClose={() => {
                    setModalVisible(false)
                }}>
                <View style={styles.modalView}>
                    <Text style={{fontSize: 20, fontWeight: "bold"}}>
                        Hello Friend!
                    </Text>
                    <Text style={{fontSize: 20}}>
                        Enter your name:
                    </Text>
                    <TextInput
                        style={styles.textInput}
                        onChangeText={(val) => setName(val)}
                    />
                    <TouchableOpacity
                        onPress={() => {
                            if (name === ''){
                                alert('Please enter a name')
                            }
                            else {
                                if (!isEmulator){
                                    registerForPushNotificationsAsync().then(token => {
                                        setExpoPushToken(token)
                                        const users = db.collection('users')
                                        users.doc().set({
                                            name: name,
                                            phone: route.params.id,
                                            notificationToken: token,
                                            notifications: true,
                                            image: null,
                                            birthdays: []
                                        }).then(() => {
                                            setModalVisible(false)
                                        })
                                    });
                                } else {
                                    const users = db.collection('users')
                                    users.doc().set({
                                        name: name,
                                        phone: route.params.id,
                                        notificationToken: expoPushToken,
                                        notifications: true,
                                        image: null,
                                        birthdays: []
                                    }).then(() => {
                                        setModalVisible(false)
                                    })
                                }
                            }
                            Alert.alert(
                                "Birthdays",
                                "Would you like to sync Birthdays Calendar for suggested birthday events?",
                                [
                                    {
                                        text: "Cancel",
                                        onPress: () => console.log("Cancel Pressed"),
                                        style: "cancel"
                                    },
                                    {
                                        text: "OK", onPress: async () => {
                                            console.log("OK Pressed")
                                            let birthdayCalendarID = []
                                            const {status} = await Calendar.requestCalendarPermissionsAsync();
                                            if (status === 'granted') {
                                                await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT)
                                                    .then((cals) => {
                                                    cals.forEach((doc) => {
                                                        if (doc.title === "Birthdays" || doc.title === "ימי הולדת") {
                                                            birthdayCalendarID.push(doc.id)
                                                        }
                                                    })
                                                })
                                            }
                                            let startDate = new Date()
                                            const endDate = new Date(startDate.getFullYear() + 1,
                                                startDate.getMonth() +1, startDate.getDate(),
                                                startDate.getHours(), startDate.getMinutes(), startDate.getSeconds())
                                            if (birthdayCalendarID.length !== 0) {
                                                let birthdays = []
                                                const events = await
                                                    getEventsAsync(birthdayCalendarID, startDate, endDate)
                                                    .then(events => {
                                                    for (let i = 0; i < events.length; i++) {
                                                        birthdays
                                                            .push([events[i].title, events[i].startDate].toString())
                                                    }
                                                })
                                                await usersCollection.where('phone', '==', route.params.id)
                                                    .get().then(snapShot => {
                                                    usersCollection.doc(snapShot.docs[0].id)
                                                        .update({birthdays: birthdays})
                                                        .then(ret=>console.log(ret))
                                                })
                                            }
                                        }
                                    }
                                ]
                            );
                        }}
                        style={styles.button}
                    >
                        <Text style={{fontSize: 20, textAlign: "center", marginTop: y * 0.01}}>
                            Submit
                        </Text>
                    </TouchableOpacity>
                </View>
            </Modal>

            {/*Next Meeting Section*/}
            <View style={{
                flex: 0.9,
                justifyContent: "center"
            }}>
                <SafeAreaView style={{
                    marginTop: 30,
                    marginBottom: 5,
                    marginLeft: 60,
                    justifyContent: "flex-end",
                    flex: 1
                }
                }>
                    <Text style={texts.header}>
                        hello {name} !
                    </Text>
                </SafeAreaView>
                <StatusBar
                    animated={true}
                    barStyle={"UIBarStyleBlackTranslucent"}
                />

                <SafeAreaView style={{
                    // FA26A0 or 8105D8
                    backgroundColor: '#FA26A0',
                    height: "70%",
                    width: "80%",
                    alignSelf: "center",
                    borderTopLeftRadius: 30,
                    borderTopRightRadius: 30,
                    borderBottomLeftRadius: 30,
                    borderBottomRightRadius: 30,
                    flex: 3
                }}>
                    <TouchableOpacity onPress={() => {
                        if(upcomingData!=null){
                            navigation.navigate('Review', {data: upcomingData, id:id})
                    }}}>
                    <ImageBackground source={require("../assets/3dshapes_texture.png")} style={{
                        width: "100%",
                        height: "100%",
                        flexDirection: "row",
                        borderTopLeftRadius: 30,
                        borderTopRightRadius: 30,
                        borderBottomLeftRadius: 30,
                        borderBottomRightRadius: 30,
                        overflow: 'hidden'
                    }} imageStyle={{opacity: 0.5}}>

                        <View style={{
                            flex: 2.4,
                            alignContent: "center",
                            justifyContent: "center",
                            marginLeft: 20
                        }}>

                            <Text style={texts.normal}>
                                Your Next Meeting is -
                            </Text>
                            <Text style={{...texts.header, color: '#fdd365', fontSize: 30}}>
                                {nextName}
                            </Text>
                            <Text style={texts.normal}>
                                At - {nextLoc}
                            </Text>
                        </View>
                        {/*Date*/}
                        <View style={{
                            flex: 1,
                            flexDirection: "column",
                            justifyContent: "center",
                            borderTopLeftRadius: 30,
                            borderTopRightRadius: 30,
                            borderBottomLeftRadius: 30,
                            borderBottomRightRadius: 30,
                            backgroundColor: '#FFFFFF50'
                        }}>
                            <Text style={{
                                fontSize: 30,
                                color: 'white',
                                alignSelf: "center",
                                textAlign: "center"
                            }}>{nextDay}/{nextMonth}
                            </Text>
                            <Text style={{
                                fontSize: 17,
                                color: 'white',
                                alignSelf: "center",
                                textAlign: "center"
                            }}>{nextHour}:{nextMin}
                            </Text>
                        </View>

                    </ImageBackground>
                    </TouchableOpacity>
                </SafeAreaView>

            </View>
            {/*Mid Section - Showing Upcoming Meetings*/}
            <View style={{
                flex: 1.5
            }}>
                <VirtualizedList
                    data={DATA}
                    initialNumToRender={4}
                    renderItem={({item}) => <Item
                        name={item.name}
                        date={item.date}
                        id={item.id}
                        nav={navigation}
                        user_id={route.params.id}
                    />}
                    keyExtractor={item => getKey()}
                    getItemCount={getItemCount}
                    getItem={getItem}
                    style={{marginTop: 30, marginBottom: 31}}
                />
            </View>
            {/*Menu Bar*/}
            <View style={{
                backgroundColor: '#05DFD7',
                flex: 0.26,
                flexDirection: "row"
            }}>
                {/*Add A Meeting*/}
                <TouchableOpacity style={{
                    flex: 1, justifyContent: 'center'

                }} onPress={() => addMeeting(navigation, route.params.id)}>
                    <Image source={require("../assets/add.png")} style={{
                        height: undefined,
                        width: undefined,
                        aspectRatio: 1,
                        flex: 0.6,
                        alignSelf: "center",
                        tintColor: 'white'
                    }}/>
                </TouchableOpacity>

                {/*Moti*/}
                <TouchableOpacity style={{flex: 1, justifyContent: 'center'}}
                                  onPress={() => moti(navigation, route.params.id)}>
                    <Image source={require("../assets/moti.png")} style={{
                        height: undefined,
                        width: undefined,
                        aspectRatio: 0.94,
                        flex: 1.5,
                        marginTop: -30,
                        alignSelf: "center"
                    }}/>
                </TouchableOpacity>

                {/*Profile Profile*/}
                <TouchableOpacity style={{flex: 1, justifyContent: 'center'}}
                                  onPress={() => profile(navigation, route.params.id)}>
                    <Image source={require("../assets/user.png")} style={{
                        height: undefined,
                        width: undefined,
                        aspectRatio: 1,
                        flex: 0.6,
                        alignSelf: "center",
                        tintColor: 'white'
                    }}/>
                </TouchableOpacity>

            </View>

        </View>
    </ImageBackground>
    );
};

export default MainScreen;

// notifications stuff:
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
    }),
});

async function registerForPushNotificationsAsync() {
    let token;
    if (Constants.isDevice) {
        const {status: existingStatus} = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
            const {status} = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }
        if (finalStatus !== 'granted') {
            alert('Failed to get push token for push notification!');
            return;
        }
        token = (await Notifications.getExpoPushTokenAsync()).data;
        //console.log(token);
    } else {
        alert('Must use physical device for Push Notifications');
    }

    if (Platform.OS === 'android') {
        Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF231F7C',
        }).then()
    }

    return token;
}

async function sendPushNotification(expoPushToken, data) {
    const message = {
        to: expoPushToken,
        sound: 'default',
        title: 'Meeting Invitation',
        body: 'You were added to a meeting, click here to view',
        data: {kind: 'inv', meeting: data},
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

const texts = StyleSheet.create({
    normal: {
        fontSize: 18,
        color: 'white'
    },
    header: {
        fontSize: 22,
        fontWeight: "bold",
        textTransform: "capitalize",
        color: '#05DFD7'
    }

})
const buttts = StyleSheet.create({
    casualbut: {
        backgroundColor: "grey", flex: 1, height: "100%", justifyContent: 'center'
    },
    motibut: {
        backgroundColor: "gold",
        flex: 1
    }
})
const fonts = StyleSheet.create({
    nextMeet: {
        fontSize: 20,
        color: "black"
    },
    event: {
        fontSize: 35,
        color: "gold"
    },
    details: {
        bottom: -5,
        fontSize: 15,
        color: "black"
    }
})
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'rgba(232,255,255,0.95)'
    },
    nextMeet: {
        flex: 0.4,
        backgroundColor: "dodgerblue",
        justifyContent: "center"
    },
    buttons: {
        flex: 0.6,
        backgroundColor: "#fff"
    },
    botBar: {
        flex: 0.1,
        backgroundColor: "grey",
        flexDirection: "row"
    },
    button: {
        borderWidth: 1,
        height: y * 0.06,
        width: x / 4,
        textAlign: "center",
        fontSize: 20,
        marginTop: 10,
        alignItems: "center",
        borderRadius: 30,
        backgroundColor: 'rgba(5,223,215,0.4)'
    },
    textInput: {
        borderWidth: 1,
        height: y * 0.08,
        width: x * 0.8,
        textAlign: "center",
        fontSize: 20,
        marginTop: 1,
        borderRadius: 10
    },
    modalView: {
        marginTop: y * 0.3,
        margin: 20,
        backgroundColor: 'white',
        borderRadius: 20,
        padding: 35,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    }
});
