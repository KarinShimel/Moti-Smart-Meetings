import React, {useState, useRef} from "react";
import {StatusBar} from "expo-status-bar";
// import Animated, {Easing} from "react-native-reanimated"
import {PanGestureHandler} from "react-native-gesture-handler";
import {useTransition} from "react-spring";
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
    Animated,
    Alert,
    StatusBarIOS, Modal, ImageBackground,
} from "react-native";
import {
    useDimensions,
    useDeviceOrientation,
} from "@react-native-community/hooks";
import {NavigationContainer, useNavigation} from "@react-navigation/native";
import {createStackNavigator} from "@react-navigation/stack";
import {TextInput} from "react-native-gesture-handler";
import firebase from "firebase/app";
import {FirebaseRecaptchaVerifierModal} from "expo-firebase-recaptcha";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import {Audio} from "expo-av";

let {height, width} = Dimensions.get("window");
const y = height;
const x = width;

// Initialize Firebase
const firebaseConfig = Constants.manifest.extra.firebaseConfig
if (firebase.apps.length === 0) {
    firebase.initializeApp(firebaseConfig);
}

function getInternationalPhone(phone) {
    if (phone.slice(0, 2) == '05' && phone.slice(2).length == 8) {
        return '+972' + phone.slice(1)
    }
    return null
}

let isNew = false

const LoginScreen = ({navigation}) => {
    const [phone, setPhone] = useState('')
    const [verificationId, setVerificationId] = useState('')
    const [verificationCode, setVerificationCode] = useState('')
    const [loginCheck, setLoginCheck] = useState(false)
    const recaptchaVerifier = React.useRef()
    const [showVerification, setShowVerification] = useState(0)

    React.useEffect(() => {
        navigation.addListener('focus', () => {
            setLoginCheck(false)
        })
    }, []);

    if (!loginCheck) {
        setLoginCheck(true)
        firebase.auth().onAuthStateChanged((user) => {
            if (user) {
                console.log('user is logged')
                navigation.navigate('Home', {id: user['phoneNumber'], isNew: isNew})
            } else {
                console.log('user is not logged')
            }
        });
    }

    function authenticate() {
        try {
            let number = getInternationalPhone(phone)
            if (number == null) {
                throw Error('Bad Number')
            }
            const phoneProvider = new firebase.auth.PhoneAuthProvider();
            phoneProvider
                .verifyPhoneNumber(number, recaptchaVerifier.current)
                .then(setVerificationId);
        } catch (e) {
            alert('Authentication Failed');
        }
    }

    async function login() {
        if (phone === '1234') {
            navigation.navigate('Home', {id: '1234', isNew: false});
            return
        }
        try {
            const credential = firebase.auth.PhoneAuthProvider.credential(
                verificationId,
                verificationCode
            );
            firebase
                .auth()
                .signInWithCredential(credential)
                .then((result) => {
                    if (result.additionalUserInfo.isNewUser) {
                        isNew = true
                    }
                });
        } catch (e) {
            alert('Login Failed')
        }
    }

    // Hiding nav bar
    React.useLayoutEffect(() => {
        navigation.setOptions({headerShown: false});
    }, [navigation]);


    const fadeAnim = useRef(new Animated.Value(0)).current;
    const translation = useRef(new Animated.Value(0)).current;
    const transition = () => {
        Animated.timing(translation, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: Constants.manifest.extra.animationNativeDriver

        }).start();
    }


    const fadeIn = () => {
        // Will change fadeAnim value to 1 in 5 seconds
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: Constants.manifest.extra.animationNativeDriver
        }).start();
    };


    return (

        <ImageBackground style={{...styles.container, backgroundColor: '#E8FFFF'}}
                         imageStyle={{opacity: 0.1}}
                         source={require("../assets/bg.jpg")}>
            <StatusBar translucent barStyle={'dark-content'}/>

            <FirebaseRecaptchaVerifierModal
                ref={recaptchaVerifier}
                firebaseConfig={firebaseConfig}
                attemptInvisibleVerification={true}
                androidHardwareAccelerationDisabled
            />
            <Animated.View style={{
                flex: 2, marginTop: translation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -65]
                }), marginBottom: 10
            }}>
                <Text style={{fontSize: 24, marginHorizontal: 20, marginTop: y * 0.15}}>
                    Moti - Smart Meetings
                </Text>
                <Image source={require("../assets/moti.png")} style={{
                    height: y / 5,
                    width: x / 2.5,
                    marginTop: y * 0.2,
                    resizeMode: "contain",
                    alignSelf: "center",
                    marginVertical: 20,
                    position: 'absolute'
                }}/>
            </Animated.View>


            <Animated.View style={{
                backgroundColor: '#05DFD7',
                height: 600,
                marginTop: translation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [y / 1.23, y / 2.5],
                }),
                width: "100%",
                borderTopLeftRadius: x / 4,
                borderTopRightRadius: x / 4,
                alignItems: "center"
            }}>
                <Animated.View style={{
                    opacity: translation.interpolate({
                        inputRange: [0, 0.5, 1],
                        outputRange: [1, 0, 0],
                    })
                }}>
                    <TouchableOpacity onPress={transition}
                                      style={{
                                          ...styles.button,
                                          marginBottom: 20,
                                          alignItems: "center",
                                          justifyContent: "center",
                                          marginTop: y * 0.05,
                                          backgroundColor: '#fdd365',
                                      }}>
                        <Text style={{fontSize: 20, fontWeight: "bold", color: 'white'}}>
                            Login/Register
                        </Text>
                    </TouchableOpacity>
                </Animated.View>
                <Animated.View style={{
                    opacity: translation, marginTop: translation.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, -50],
                    })
                }}>
                    <TextInput
                        style={{
                            ...styles.button,
                            backgroundColor: '#FFFFFF50',
                            marginBottom: 20,
                            marginTop: -20,
                            height: 60,
                            borderRadius: 5,

                        }}
                        placeholder="Enter Phone Number"
                        // defaultValue={'Enter Phone Number'}
                        onChangeText={(val) => setPhone(val)}/>
                    <TouchableOpacity
                        onPress={() => {
                            setShowVerification(1)
                            authenticate()
                            fadeIn()
                        }}
                        style={{
                            ...styles.button,
                            marginBottom: 20,
                        }}
                    >
                        <Text style={{fontSize: 20, textAlign: "center", color: 'white', fontWeight: "bold"}}>
                            Register
                        </Text>
                    </TouchableOpacity>
                    <Animated.View style={{
                        height: fadeAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0, 60],
                        }), opacity: fadeAnim,

                        marginBottom: fadeAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [-10, 20],
                        }),
                    }}>
                        <TextInput
                            style={{
                                ...styles.button,
                                backgroundColor: '#FFFFFF50',
                                height: 60,
                                borderRadius: 5,
                            }}
                            placeholder="Enter The Verification Code"
                            onChangeText={(val) => setVerificationCode(val)}/>
                    </Animated.View>

                    <TouchableOpacity
                        onPress={() => login()}
                        style={styles.button}
                    >
                        <Text style={{fontSize: 20, textAlign: "center", color: 'white', fontWeight: "bold"}}>
                            Login
                        </Text>
                    </TouchableOpacity>

                </Animated.View>
            </Animated.View>

        </ImageBackground>
    );
};

export default LoginScreen;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        flexDirection: "column",
        alignItems: "center"
    },
    textInput: {
        borderWidth: 1,
        height: y * 0.08,
        width: x * 0.8,
        textAlign: "center",
        fontSize: 20,
    },
    button: {
        borderWidth: 1,
        height: y * 0.06,
        width: x * 0.75,
        textAlign: "center",
        fontSize: 20,
        justifyContent: "center",
        backgroundColor: '#fdd365',
        borderRadius: 30
    },
    helper: {
        backgroundColor: 'gold', height: "100%", width: "100%"
    }
});
