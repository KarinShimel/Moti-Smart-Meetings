import React, {useEffect, useRef, useState} from 'react';
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
    LogBox, BackHandler, Modal
} from 'react-native';
import {useDimensions, useDeviceOrientation} from '@react-native-community/hooks';
import {NavigationContainer, useRoute} from '@react-navigation/native';
import {createStackNavigator} from '@react-navigation/stack';
import {TextInput} from "react-native-gesture-handler";
import "firebase/firestore";
import async from "async";
import firebase from "firebase/app";
import * as Notifications from "expo-notifications";
import {Notifications as NotificationsOld} from 'expo';
import Constants from "expo-constants";
import {Audio} from 'expo-av'



const PORT = Constants.manifest.extra.PORT
let SERVER_IP_ADDRESS = Constants.manifest.extra.SERVER_IP_ADDRESS

let {height, width} = Dimensions.get("window");
const y = height;
const x = width;

// Initialize Firebase
const firebaseConfig = Constants.manifest.extra.firebaseConfig
if (firebase.apps.length === 0) {
    firebase.initializeApp(firebaseConfig);
}

const db = firebase.firestore()
const users = db.collection('users')
const creds = db.collection('unicorns')

const MotiScreen = ({navigation, route}) => {
    const [modalVisible, setModalVisible] = useState(false);
    const [modalVisible2, setModalVisible2] = useState(false);
    const [getNotifications, setGetNotifications] = useState('?') // Active/Disabled
    const [userFirebaseID, setUserFirebaseID] = useState('?')
    const [what, setWhat] = useState('');
    const [where, setWhere] = useState('');
    const [other, setOther] = useState('');


    // Hiding nav bar
    React.useLayoutEffect(() => {
        navigation.setOptions({headerShown: false});
    }, [navigation]);


    React.useEffect(() => {
        const doc = creds.doc('server_ip').get().then(ret => {
            SERVER_IP_ADDRESS = ret.data()['ip']
        })
        const querySnapshot = users
            .where('phone', '==', route.params.id)
            .get().then(querySnapshot => {
                if (!querySnapshot.empty) {
                    const notif = querySnapshot.docs[0].data()['notifications']
                    setUserFirebaseID(querySnapshot.docs[0].id)
                    if (notif === true) {
                        setGetNotifications('Active')
                    } else {
                        setGetNotifications('Disabled')
                    }
                }
            })
    }, []);

    function generateMeeting(navigation, id) {
        setModalVisible(true)
        try {
            fetch('http://' + SERVER_IP_ADDRESS + ':' + PORT + '/generate_meeting?id=' + id)
                .then(response => {
                    setModalVisible(false)
                    if (response.status !== 200) {
                        alert('Something went wrong, please try again later');
                        return null
                    }
                    response.json().then(response => {
                        if (response == null) {
                            return
                        }
                        navigation.navigate('Suggest', {meet: response, id: id})
                    })
                })
        } catch (e) {
            console.log('error connecting to server')
        }
    }

    function setNotification() {
        let value = false
        let text = 'Disabled'
        if (getNotifications === 'Disabled') {
            value = true;
            text = 'Active'
        }
        if (userFirebaseID !== '?') {
            users.doc(userFirebaseID).update({notifications: value}).then(setGetNotifications(text))
        }
    }

    function SubmitPlaceFunction(navigation, id) {
        if (what === '' || where === '') {
            alert('Please enter values');
            return
        }
        try {
            const url = 'http://' + SERVER_IP_ADDRESS + ':' + PORT + '/scrap_meeting?id=' + route.params.id + '&thing=' + what + '&area=' + where + '&details=' + other
            fetch(url)
                .then(response => {
                    setModalVisible2(false)
                    if (response.status !== 200) {
                        alert('Something went wrong, please try again later');
                        return null
                    }
                    response.text().then(data=>{
                        if (data.slice(-1) !== ']'){data = data+']'}
                        const arr = JSON.parse(data)
                        if (arr.length === 0){
                            alert('Nothing found, please try again')
                            return
                        }
                        navigation.navigate('Places', {places: arr, id: id})
                    })
                })
        } catch (e) {
            console.log('error connecting to server')
        }



    }

    return (
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
                    <Text style={{fontSize: 20}}>
                        Generating a meeting...
                    </Text>
                    <Text style={{fontSize: 20}}>
                        Please wait
                    </Text>
                </View>
            </Modal>

            <Modal
                animationType="slide"
                transparent={true}
                visible={modalVisible2}
                onRequestClose={() => {
                    setModalVisible2(false)
                }}>
                <View style={styles.modalView}>
                    <Text style={{textAlign: 'center', fontSize: 22}}>What are you looking for?</Text>
                    <TextInput style={{
                        borderWidth: 1,
                        height: y * 0.08,
                        width: x * 0.8,
                        textAlign: "center",
                        fontSize: 20,
                    }} onChangeText={(what) => setWhat(what)}/>
                    <Text style={{textAlign: 'center', fontSize: 22}}>Where?</Text>
                    <TextInput style={{
                        borderWidth: 1,
                        height: y * 0.08,
                        width: x * 0.8,
                        textAlign: "center",
                        fontSize: 20,
                    }} onChangeText={(where) => setWhere(where)}/>
                    <Text style={{textAlign: 'center', fontSize: 22}}>Other Details?</Text>
                    <TextInput style={{
                        borderWidth: 1,
                        height: y * 0.08,
                        width: x * 0.8,
                        textAlign: "center",
                        fontSize: 20,
                    }} onChangeText={(other) => setOther(other)}/>
                    <TouchableOpacity onPress={() => {
                        SubmitPlaceFunction(navigation, route.params.id)
                    }} style={{
                        borderRadius: 20,
                        backgroundColor: 'rgba(255,255,255,0.2)',
                        borderColor: 'rgba(223,34,119,1)',
                        width: "70%",
                        height: height / 10,
                        alignSelf: "center",
                        justifyContent: "center",
                        borderWidth:1,
                        marginTop: 20,

                    }}>
                        <Text style={{textAlign: 'center', fontSize: 24}}>Submit</Text>
                    </TouchableOpacity>


                </View>
            </Modal>

            <Image source={require("../assets/moti.png")} style={{
                height: y / 5,
                width: x / 2.5,
                resizeMode: "contain",
                alignSelf: "center",
                marginBottom: 50,
            }}/>
            <TouchableOpacity onPress={() => {
                generateMeeting(navigation, route.params.id)
            }} style={styles.butt}>
                <Text style={styles.butttext}>Generate a meeting!</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => {
                setModalVisible2(true)
            }} style={styles.butt}>
                <Text style={styles.butttext}>Look For Place</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => {
                setNotification()
            }} style={styles.butt}>
                <Text style={styles.butttext}>Notifications: {getNotifications}</Text>
            </TouchableOpacity>

        </View>
    );
};

export default MotiScreen;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'rgba(232,255,255,1)',
        paddingTop: height / 10
    },
    butt: {
        height: y * 0.08,
        backgroundColor: '#05DFD7',
        justifyContent: 'center',
        alignContent: 'center',
        margin: 15,
        borderRadius: 30,
        width:"90%",
        alignSelf:"center"

    },
    butttext:{
        textAlign: 'center',
        fontSize: 24,
        color:'white',
        fontWeight:"bold"
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
        width: x * 0.75,
        textAlign: "center",
        fontSize: 20,
        marginTop: 10,
    },
    textInput: {
        borderWidth: 1,
        height: y * 0.08,
        width: x * 0.8,
        textAlign: "center",
        fontSize: 20,
        marginTop: 1,
    },
    modalView: {
        marginTop: 30,
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
