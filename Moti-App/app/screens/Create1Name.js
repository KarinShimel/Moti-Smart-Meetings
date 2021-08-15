import React, {useRef, useState} from 'react';
import { StatusBar } from 'expo-status-bar';
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
    Image,
    Button,
    Alert,
    StatusBarIOS,
    LogBox, BackHandler, ImageBackground
} from 'react-native';
import { useDimensions, useDeviceOrientation} from '@react-native-community/hooks';
import {NavigationContainer, useRoute} from '@react-navigation/native';
import {createStackNavigator} from '@react-navigation/stack';
import {TextInput} from "react-native-gesture-handler";
import firebase from "firebase/app";
import "firebase/firestore";
import async from "async";
import Constants from "expo-constants";
import {Audio} from "expo-av";

let { height, width } = Dimensions.get("window");
const y = height;
const x = width;
// TODO: Add image to meetings
function nextScreen(navigation,id,name,desc){
    if(name==''){alert('Enter a valid name')}
    navigation.navigate('Create2',{id:id,name:name,desc:desc})
}

const Create1Name = ({navigation,route}) => {
    const [name, setName] = useState('');
    const [desc, setDesc] = useState('');
    const [id, setId] = useState(route.params.id);



    // Hiding nav bar
    React.useLayoutEffect(() => {
        navigation.setOptions({headerShown: false});
    }, [navigation]);

    // React.useEffect(
    //     () =>
    //         navigation.addListener('beforeRemove', (e) => {
    //             if (!name) {
    //                 // If we don't have unsaved changes, then we don't need to do anything
    //                 return;
    //             }
    //
    //             // Prevent default behavior of leaving the screen
    //             e.preventDefault();
    //
    //             // Prompt the user before leaving the screen
    //             Alert.alert(
    //                 'Cancel Meeting?',
    //                 'Leaving this page will cancel the meeting. ',
    //                 [
    //                     { text: "Continue", style: 'cancel', onPress: () => {} },
    //                     {
    //                         text: 'Cancel',
    //                         style: 'destructive',
    //                         // If the user confirmed, then we dispatch the action we blocked earlier
    //                         // This will continue the action that had triggered the removal of the screen
    //                         onPress: () => navigation.dispatch(e.data.action),
    //                     },
    //                 ]
    //             );
    //         }),
    //     [navigation, name]
    // );




    const keyboardAnim = useRef(new Animated.Value(0)).current;
    const keyBoardAnimation = () => {
        Animated.timing(keyboardAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: Constants.manifest.extra.animationNativeDriver
        }).start();
    }

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const fadeIn = () => {
        // Will change fadeAnim value to 1 in 5 seconds
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: Constants.manifest.extra.animationNativeDriver
        }).start();
    };
    return (
            <ImageBackground source={require('../assets/palmtrees.jpg')}
                             imageStyle={{opacity:1}}
                             style={{width:"100%",height:"100%"}}
            >
                <View style={{flex: 1,
                    backgroundColor: 'rgba(232,255,255,0.7)'
                }}
                >
                    <StatusBar translucent barStyle={'default'} />
            <Animated.View style={{ centerContent:true,justifyContent:'center',alignItems:'center',marginTop:y/6
                }}>
                <Text style={styles.text}>Meeting Name</Text>
                <TextInput style={styles.textBlock} onChangeText={(name) => {
                    setName(name)
                    fadeIn()
                }}
                />

                <Text style={{...styles.text,marginTop:20}}>Description</Text>
                <TextInput style={styles.textBlock} onChangeText={(desc) => setDesc(desc)}/>
                <Animated.View style={{opacity:fadeAnim.interpolate({inputRange:[0,1], outputRange:[0.1,1]})}}>
                    <TouchableOpacity onPress={() =>  nextScreen(navigation,id,name,desc) } style={{ marginTop:10,justifyContent:'center',alignContent:'center'}}>
                        <Text style={{textAlign:'center', fontSize:24,color:'rgba(223,34,119,1)',fontWeight:"bold"}}>Next</Text>
                    </TouchableOpacity>
                </Animated.View>
            </Animated.View>



                </View>
            </ImageBackground>

    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#05DFD7'
    },
    text:{
        textAlign:'center', fontSize:24,color:'rgba(223,34,119,1)',fontWeight:"bold"
    },
    textBlock:{
borderWidth: 1,
    height: y * 0.08,
    borderColor:'rgba(223,34,119,1)',
    width: x * 0.8,
    borderRadius:30,
    textAlign: "center",
        backgroundColor: '#FFFFFF80',
    fontSize: 20,
        color: 'rgba(223,34,119,1)'
    }
})

export default Create1Name;


