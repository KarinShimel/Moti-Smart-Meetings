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
    Animated,
    ImageBackground,
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
import * as ImagePicker from 'expo-image-picker';
import firebase from "firebase/app";
import Constants from "expo-constants";
import {Audio} from "expo-av";


// TODO: Add route to view old meetings screen

let {height, width} = Dimensions.get("window");
const y = height;
const x = width;

// Initialize Firebase
const firebaseConfig = Constants.manifest.extra.firebaseConfig
if (firebase.apps.length === 0) {
    firebase.initializeApp(firebaseConfig);
}

const db = firebase.firestore();
const users = db.collection('users')

async function getUser(user) {
    let nameIs = ''
    await users.where('phone', '==', user).get().then(querySnap => {
        if (querySnap.docs.length === 0) {nameIs = null; }
        else {nameIs = querySnap.docs[0].data()}
    })
    return nameIs
}

function getFileName(name, path) {
    if (name != null) { return name; }

    if (Platform.OS === "ios") {
        path = "~" + path.substring(path.indexOf("/Documents"));
    }
    return path.split("/").pop();
}

function logOut(navigation) {
    firebase.auth().signOut().then(navigation.pop(2))
}

function goToMeetingScreen(navigation, id) {
    navigation.navigate('Meetings',{id: id})
}

const Profile = ({navigation, route}) => {
    const [modalVisible, setModalVisible] = useState(false);
    const [user, setUser] = useState(null)
    const [url, setUrl] = useState();
    const [hasImage, setHasImage] = useState(0)
    const [modalExecuted, setModalExecuted] = useState(false)



    let reff = ''
// Hiding nav bar
    React.useLayoutEffect(() => {
        navigation.setOptions({headerShown: false});
    }, [navigation]);

    useEffect(() => {
        (async () => {
            if (Platform.OS !== 'web') {
                const {status} = await ImagePicker.requestMediaLibraryPermissionsAsync();
                if (status !== 'granted') {
                    alert('Sorry, we need camera roll permissions to make this work!');
                }
            }
        })();
    }, []);


    const pickImage = async () => {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.All,
            allowsEditing: true,
            aspect: [3, 3],
            quality: 1,
        }).then((result)=>{
            if (!result.cancelled) {
                // User picked an image
                const {height, width, type, uri} = result;
                return uriToBlob(uri);
            }
        }).then((blob)=>{
            return uploadToFirebase(blob);
        }).then((snapshot)=>{
            console.log("File uploaded");
            setUrl(null)
        }).catch((error)=>{
            console.log('ig error => ', error);
        });
    };

    const uriToBlob = (uri) => {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.onload = function() {
                // return the blob
                resolve(xhr.response);
            };

            xhr.onerror = function() {
                // something went wrong
                reject(new Error('uriToBlob failed'));
            };
            // this helps us get a blob
            xhr.responseType = 'blob';
            xhr.open('GET', uri, true);

            xhr.send(null);
        });
    }

   const uploadToFirebase = (blob) => {

        return new Promise((resolve, reject)=>{

            let storageRef = firebase.storage().ref();

            storageRef.child('/users/'+user['phone']+'.png').put(blob, {
                contentType: 'image/png'
            }).then((snapshot)=>{
                blob.close();
                resolve(snapshot);
            }).catch((error)=>{
                reject(error);
            });
        });

    }
    if (user == null) {
        getUser(route.params.id).then(doc => {
            setUser(doc)
        })
    }
    if (url == null && user !=null) {
        reff = firebase.storage().ref('/users/'+user['phone'].toString() + '.png');
        reff
            .getDownloadURL()
            .then((url) => {
                setUrl(url);
                setHasImage(1)
            }).catch((e) => {
            setUrl('none')
            console.log('getting downloadURL of image error => ', e)
        });
    }
    if (url == null) {
        return null
    }
    if (user == null) {
        return null
    }
    return (

        <View style={{flex: 1, backgroundColor: '#E8FFFF'}}>
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
                        Enter your name:
                    </Text>
                    <TextInput
                        style={styles.textInput}
                        onChangeText={(val) => user['name']=val.toString().trim()}
                    />
                    <TouchableOpacity
                        onPress={() => {
                            setModalVisible(false)
                            users.where('phone', '==', route.params.id).get().then(querySnapshot => {
                                querySnapshot.forEach((doc) => {
                                    users.doc(doc.id).update({name: user['name']}).then()
                                });
                            })
                        }}
                        style={styles.button}
                    >
                        <Text style={{fontSize: 20, textAlign: "center", marginTop: y * 0.01}}>
                            Submit
                        </Text>
                    </TouchableOpacity>
                </View>
            </Modal>


            {/* Profile data section */}

            <Animated.View style={{
                flex: 3,
            }}>
                <ImageBackground style={{backgroundColor: 'rgba(223,34,119,1)',overflow:'hidden',height:"100%",width:"100%",
                    borderBottomRightRadius: 60,
                    justifyContent: "center",
                    borderBottomLeftRadius: 60
                }} source={require('../assets/cool_bg.jpg')}
                                 imageStyle={{overflow:'hidden',opacity: 0.15}}>
                    <Animated.View style={{
                        alignSelf: "center",
                        borderWidth:3,
                        borderColor:'white',
                        overflow: 'hidden',
                        height: 140,
                        width: 140,
                        alignItems: "center",
                        justifyContent: "center",
                        borderTopRightRadius: 70,
                        borderTopLeftRadius: 70,
                        borderBottomRightRadius: 70,
                        borderBottomLeftRadius: 70,
                        backgroundColor: 'white'
                    }}>
                        <TouchableOpacity
                            onPress={pickImage}
                        >
                            <Text style={{
                                alignSelf: "center",
                                justifyContent: "center",
                                flex: 0.01 * (hasImage * 100),
                            }}> {user['name']}</Text>
                            {url && <Image source={{uri: url}} style={{width: 140, height: 140}}/>}
                        </TouchableOpacity>
                    </Animated.View>
                    <Text style={{
                        color: '#ffffff',
                        justifyContent: "center",
                        alignSelf: "center",
                        marginTop: 20,
                        fontSize: 24,
                        fontWeight:"bold"
                    }}>
                        {user['name']}
                    </Text>
                </ImageBackground>
            </Animated.View>


            {/* Change Name */}
            <View style={{flex:3, alignItems:"center"}}>
                <Animated.View style={{}}>
                    <TouchableOpacity style={buttts.casualbut} onPress={() => setModalVisible(true)}>
                        <Text style={{textAlign: 'center', fontSize: 20}}>Change Name</Text>
                    </TouchableOpacity>
                </Animated.View>

                {/* Meetings Data */}
                <Animated.View style={{}}>

                    <TouchableOpacity style={buttts.casualbut} onPress={() =>  goToMeetingScreen(navigation,route.params.id)}>
                        <Text style={{textAlign: 'center', fontSize: 20}}>View Past Meetings</Text>
                    </TouchableOpacity>

                </Animated.View>


                {/* Log Out */}
                <View style={{}}>
                    <TouchableOpacity style={buttts.casualbut} onPress={() => {
                        logOut(navigation)
                    }}>
                        <Text style={{textAlign: 'center', fontSize: 20}}>Log Out</Text>
                    </TouchableOpacity>
                </View>
            </View>
            <View style={{ flex:0.7,backgroundColor:'#fdd365',borderTopRightRadius:100,borderTopLeftRadius:100,
                marginBottom:-60,alignItems:"center" ,width:"90%",alignSelf:"center"}}>
                <Text style={{marginTop:3,fontSize:15,color:'black'}}>Moti inc.</Text>
            </View>


        </View>
    );
};

export default Profile;

const buttts = StyleSheet.create({
    casualbut: {
        borderWidth: 1,
        height: y * 0.06,
        marginTop:y/15,
        width: x * 0.75,
        textAlign: "center",
        fontSize: 20,
        justifyContent: "center",
        backgroundColor: 'rgba(5,223,215,0.6)',
        borderRadius: 30    },
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
        flex: 1
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
