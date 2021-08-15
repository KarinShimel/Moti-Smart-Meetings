import React, {useState} from 'react';
import { StatusBar } from 'expo-status-bar';
import {
    StyleSheet,
    Platform,
    VirtualizedList,
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
    ScrollView, ImageBackground
} from 'react-native';
import { useDimensions, useDeviceOrientation} from '@react-native-community/hooks';
import { NavigationContainer } from '@react-navigation/native';
import {createStackNavigator} from '@react-navigation/stack';
import { color } from 'react-native-reanimated';
import firebase from "firebase";
import {TextInput} from "react-native-gesture-handler";
import Constants from "expo-constants";
import {Audio} from "expo-av";

let { height, width } = Dimensions.get("window");
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



function dateToString(date){
    const yr = 2000+(parseInt(date['year'])%100)
    const date2 = new Date(yr,date['month']-1,date['day'],date['hours'],date['mins'])
    return getTimeFromTimestamp(firebase.firestore.Timestamp.fromDate(date2))
}
function getTimeFromTimestamp(stamp2){
    if (stamp2 == null){return ''}
    const stamp = firebase.firestore.Timestamp.fromMillis(parseInt(stamp2['seconds'])*1000)
    try {
        const dateList = stamp.toDate().toString().split(' ')
        const day = dateList[0]
        const date = dateList[2] + '-' + dateList[1] + '-' + dateList[3].substring(2, 4)
        const time = dateList[4].substring(0, 5)
        return day + '  ' + date + '  ' + time
    }catch (e) {
        console.log('error parsing time')
    }
}

async function createMeeting(navigation,id,name,desc,date,location,participants,cameFromPlaces){
    const yr = 2000+(parseInt(date['year'])%100)
    const date2 = new Date(yr,date['month']-1,date['day'],date['hours'],date['mins'])
    await meetings.add({
        name: name, date: firebase.firestore.Timestamp.fromDate(date2), location: location, description: desc
        , participants: participants
    }).then(docRef => {
        meetings.doc(docRef.id).get().then(doc => {
            participants.forEach(x=>{
                if(x['id']!==id) {
                    sendPushNotification(x['notifToken'], doc.data()).then();
                }
            })
        })
        Alert.alert('Success','Meeting Created')
    })

    if(cameFromPlaces){
        navigation.pop(4)
    }
    else{
        navigation.pop(3)
    }
    //navigation.pop(3)
}
async function sendPushNotification(expoPushToken,meeting) {
    const message = {
        to: expoPushToken,
        sound: 'default',
        title: 'Meeting Invitation',
        body: 'You were added to a meeting, click here to view',
        data: {kind:'inv',meeting:meeting},
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
async function updateMeeting(navigation, meeting, name, desc, date, location, participants) {
    const yr = 2000+(parseInt(date['year'])%100)
    const date2 = new Date(yr,date['month']-1,date['day'],date['hours'],date['mins'])
    await  meetings.get().then(querySnapshot=>{
        querySnapshot.forEach((doc) => {
            console.log(doc.id)
            if(doc.id == meeting['id']){
                console.log("THIS IS IT",doc.id)
                meetings.doc(doc.id).update({
                    name: name, date: firebase.firestore.Timestamp.fromDate(date2), location: location, description: desc

                }).then()
            }
        });
    })
    Alert.alert('Success', 'Meeting Created')
    navigation.pop(1)
}
const SuggestMeeting = ({navigation,route}) => {
    const meeting = route.params.meet
    const [editMode, setEditMode] = useState(false);
    const [users, setUsers] = useState(null);
    const [name, setName] = useState(meeting['name']);
    const [desc, setDesc] = useState(meeting['description']);
    const [date, setDate] = useState(meeting['date']);
    const [day, setDay] = useState(meeting['date']['day'].toString());
    const [month, setMonth] = useState(meeting['date']['month'].toString());
    const [year, setYear] = useState(meeting['date']['year'].toString());
    const [hours, setHour] = useState(meeting['date']['hours'].toString());
    const [minutes, setMinute] = useState(meeting['date']['mins'].toString());
    const [location, setLocation] = useState(meeting['location']);
    const [participants, setParticipants] = useState(meeting['participants']);

    const [prevScreen, setPrevScreen] = useState(route.params.prev_screen)

    // Hiding nav bar
    React.useLayoutEffect(() => {
        navigation.setOptions({headerShown: false});
    }, [navigation]);

    if(users==null){getParticipants(participants).then(value => setUsers(value))}
    async function getParticipants(p){
        let res = ''
        let pCopy = JSON.parse(JSON.stringify(p))
        if (p.length === 0 ){return ''}
        const querySnapshot = await usersCollection
            .where('phone', 'in', p).get()
        if (querySnapshot.empty) {return -1}
        querySnapshot.forEach((doc) => {
            const index = pCopy.indexOf(doc.data()['phone'])
            if (index > -1) {
                pCopy.splice(index, 1);
            }
            res = res+doc.data()['name']+', '
        });
        pCopy.forEach(number => {
            res = res+number+', '
        })
        return res.substring(0,res.length-2)
    }

    if(!editMode){
    return ( // show mode
        <ImageBackground source={require('../assets/vortex_bg.jpg')}
                         style={{height: "100%", width: "100%"}}
                         imageStyle={{resizeMode: "cover"}}>
        <View style={styles.container}>
            <StatusBar translucent barStyle={'default'} />
            <View style={{flex:0.8}}>
                {/*name*/}
                <View style={{marginTop: 30,}}>
                    <Text style={{textAlign: 'center',
                        fontSize: 45,
                        color: 'rgba(223,34,119,1)',
                        textTransform: "capitalize",
                        fontWeight: "bold"}}>
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
                    <Text style={{fontSize: 28, textAlign: 'center',color:'#05DFD7',fontWeight:"bold"}}>
                        {location}
                    </Text>
                </View>
                {/*date*/}
                <View style={{marginTop:6}}>
                    <Text style={{fontSize: 24, textAlign: 'center',color:'#05DFD7',fontWeight:"bold"}}>
                        {dateToString(date)}
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
                    <Text style={{textAlign: 'center',
                        fontSize: 30,
                        color: 'rgba(223,34,119,1)',
                        textTransform: "capitalize",
                        fontWeight: "bold"}}>
                        Participants:
                    </Text>
                    <Text style={{fontSize: 22, textAlign: 'center',color:'#05DFD7',fontWeight:"bold"}}>

                        {users}
                    </Text>
                </View>
            </View>



            <View style={{flex: 0.3, marginTop: height/20}}>
                    <TouchableOpacity onPress={() => setEditMode(true)} style={{
                        borderRadius: 20,
                        backgroundColor: 'rgba(255,255,255,0.2)',
                        borderColor: 'rgba(223,34,119,1)',
                        width: "80%",
                        height: height / 12,
                        alignSelf: "center",
                        justifyContent: "center",
                        borderWidth:1
                    }}>
                        <Text style={{textAlign: 'center', fontSize: 24,color: 'rgba(223,34,119,1)',fontWeight:"bold"}}>Edit</Text>
                    </TouchableOpacity>

                <TouchableOpacity
                    onPress={() =>{
                        const date2 = {year:year, month:month, day:day, hours:hours, mins:minutes}
                        let cameFromPlaces = false
                        // Need to delete this line after checking suggest ref name
                        // --------------------------------------------------------!
                        if (prevScreen===("Places")) {
                            cameFromPlaces = true
                            //check
                        }
                        createMeeting(navigation, meeting, name, desc, date2, location, participants,cameFromPlaces)}}
                    style={{ borderRadius: 20,
                        backgroundColor: 'rgba(255,255,255,0.2)',
                        borderColor: 'rgba(223,34,119,1)',
                        width: "80%",
                        height: height / 12,
                        alignSelf: "center",
                        justifyContent: "center",
                        borderWidth:1,
                        marginTop:10
                    }}>
                    <Text style={{textAlign: 'center', fontSize: 24,fontWeight:"bold",color: 'rgba(223,34,119,1)'}}>Create Meeting</Text>
                </TouchableOpacity>
            </View>

        </View>
        </ImageBackground>
    );
    } else{
        return ( // edit mode
            <ImageBackground source={require('../assets/vortex_bg.jpg')}
                             style={{height: "100%", width: "100%"}}
                             imageStyle={{resizeMode: "cover"}}>
            <View style={styles.container}>
                <View style={{flex:0.8}}>
                    <ScrollView contentContainerStyle={{alignItems:'center',flexGrow:1}}>
                        {/*name*/}
                        <Text style={{textAlign: 'center', fontSize: 22, marginTop: 10,color: 'rgba(223,34,119,1)',fontWeight:"bold"}}>Name</Text>
                        <TextInput style={styles.editTextBig}
                                   onChangeText={(val) => setName(val)}
                                   defaultValue={name}/>
                        {/*desc*/}
                        <Text style={{textAlign: 'center', fontSize: 22, marginTop: 10,color: 'rgba(223,34,119,1)',fontWeight:"bold"}}>Description</Text>
                        <TextInput style={styles.editTextBig}
                                   onChangeText={(val) => setDesc(val)}
                                   defaultValue={desc}/>
                        {/*location*/}
                        <Text style={{textAlign: 'center', fontSize: 22, marginTop: 10,color: 'rgba(223,34,119,1)',fontWeight:"bold"}}>Location</Text>
                        <TextInput style={styles.editTextBig}
                                   onChangeText={(val) => setLocation(val)}
                                   defaultValue={location}/>
                        {/*date*/}
                        <Text style={{textAlign: 'center', fontSize: 16, marginTop: 10,color: 'rgba(223,34,119,1)',fontWeight:"bold"}}>Date</Text>
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

                        <Text style={{textAlign: 'center', fontSize: 16, marginTop: 10,color: 'rgba(223,34,119,1)',fontWeight:"bold"}}>Time</Text>
                        <View style={{flexDirection: 'row'}}>
                            <TextInput style={styles.editTextSmall}
                                       onChangeText={(val) => setMinutes(val)}
                                       placeholder={minutes.toString()}
                                       defaultValue={minutes.toString()}/>
                            <TextInput style={styles.editTextSmall}
                                       onChangeText={(val) => setHours(val)}
                                       placeholder={hours.toString()}
                                       defaultValue={hours.toString()}/>

                        </View>
                        {/*participants*/}
                        <View style={{marginTop:10}}>
                            <Text style={{fontSize:22, textAlign:'center',color: 'rgba(223,34,119,1)',fontWeight:"bold"}}>
                                Participants
                            </Text>
                            <TouchableOpacity onPress={() => {
                                // update date object:
                                const date2 = {year:year, month:month, day:day, hours:hours, mins:minutes}
                                navigation.navigate('Create4',{id:route.params.id,name:name,desc:desc,date:date2,
                                    location:location,participants:participants, prev_screen: route.name, meeting_id:meeting['id']})
                            }}
                                              style={{justifyContent:'center',alignContent:'center'}}>
                                <Text style={{textAlign:'center', fontSize:22}}>{users}</Text>
                            </TouchableOpacity>
                            {/*<Text style={{fontSize:20, textAlign:'center'}}>*/}
                            {/*    {users}*/}
                            {/*</Text>*/}

                        </View>
                    </ScrollView>

                </View>

                <View style={{flex:0.1, marginLeft:10, marginRight:10}}>
                    <TouchableOpacity onPress={() => setEditMode(false)} style={{ borderRadius: 20,
                        backgroundColor: 'rgba(255,255,255,0.2)',
                        borderColor: 'rgba(223,34,119,1)',
                        width: "80%",
                        height: height / 12,
                        alignSelf: "center",
                        justifyContent: "center",
                        borderWidth:1}}>
                        <Text style={{textAlign:'center', fontSize:24,fontWeight:"bold",color: 'rgba(223,34,119,1)'}}>View Mode</Text>
                    </TouchableOpacity>
                </View>

                <View style={{flex: 0.1, marginTop: height/20}}>
                    <TouchableOpacity
                        // bug fixed
                        onPress={() =>{
                            const date2 = {year:year, month:month, day:day, hours:hours, mins:minutes}
                            createMeeting(navigation, meeting, name, desc, date2, location, participants)}}
                        style={{ borderRadius: 20,
                            backgroundColor: 'rgba(255,255,255,0.2)',
                            borderColor: 'rgba(223,34,119,1)',
                            width: "80%",
                            height: height / 12,
                            alignSelf: "center",
                            justifyContent: "center",
                            borderWidth:1}}>
                        <Text style={{textAlign: 'center', fontSize: 24,fontWeight:"bold",color: 'rgba(223,34,119,1)'}}>Create Meeting</Text>
                    </TouchableOpacity>
                </View>

            </View>
            </ImageBackground>
        )
    }
}
const textStyles = StyleSheet.create({
    meetingTitle:{
        fontSize:30,
        color: "black"
    },
    normalText:{
        fontSize:24,
        color: "black"
    }
})
const styles = StyleSheet.create({
    editTextBig:{
        borderWidth: 1,
        height: y * 0.08,
        width: x * 0.8,
        textAlign: "center",
        fontSize: 20,
        borderRadius:15,
        backgroundColor:'rgba(5,223,215,0.15)'
    },
    editTextSmall:{
        borderWidth: 0.2,
        height: y * 0.08,
        width: x * 0.2,
        textAlign: "center",
        fontSize: 20,
        borderRadius: 10,
        backgroundColor:'rgba(5,223,215,0.15)'
    },
    container:{
        flex: 1,
        alignContent: "center",
        paddingTop: y / 16,
        backgroundColor: 'rgba(232,255,255,0.9)'
    },
    name:{
        flex:0.7,
        backgroundColor: "gold",
        justifyContent: "center",
        alignItems: "center"
    },
    status:{
        flex:0.3,
        backgroundColor: "white",
        justifyContent: "center",
        alignItems: "center"
    },
    timedate:{
        flex:0.5,
        backgroundColor: "dodgerblue",
        justifyContent: "center",
        alignItems: "center"
    },
    participants:{
        flex:2,
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
export default SuggestMeeting;
