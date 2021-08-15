import React, {useRef, useState} from 'react';
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
    LogBox, BackHandler, DatePickerAndroid, ImageBackground, Animated
} from 'react-native';
import "firebase/firestore";
import {TextInput} from "react-native-gesture-handler";
import Constants from "expo-constants";
import {Audio} from "expo-av";

let {height, width} = Dimensions.get("window");
const y = height;
const x = width


function nextScreen(navigation, id, name, desc, date, location, route) {
    if (location == '') {
        alert('Please Enter Location');
        return
    }
    navigation.navigate('Create4', {
        id: id, name: name, desc: desc, date: date, location: location, participants: null,
        prev_screen: route.name
    })
}

const Create3Location = ({navigation, route}) => {
    const [name, setName] = useState(route.params.name);
    const [desc, setDesc] = useState(route.params.desc);
    const [id, setId] = useState(route.params.id);
    const [date, setDate] = useState(route.params.date);
    const [location, setLocation] = useState('');


    // Hiding nav bar
    React.useLayoutEffect(() => {
        navigation.setOptions({headerShown: false});
    }, [navigation]);

    const next = useRef(new Animated.Value(0)).current
    const nextAnim = () => {
        // Will change fadeAnim value to 1 in 5 seconds
        Animated.timing(next, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: Constants.manifest.extra.animationNativeDriver
        }).start();
    };
//
    return ( //
        <ImageBackground source={require('../assets/building.jpg')}
                         style={{height: "100%", width: "100%"}}
                         imageStyle={{resizeMode: "cover"}}
        >
            <View style={{
                flex: 1, alignItems: 'center',
                backgroundColor: 'rgba(232,255,255,0.6)'

            }}>
                <StatusBar translucent barStyle={'default'} />
                <View style={{centerContent: true, alignItems: 'center', marginTop: y / 6}}>
                    <Text style={{
                        textAlign: 'center',
                        fontSize: 30,
                        color: 'rgba(223,34,119,1)',
                        fontWeight: "bold"
                    }}>Location</Text>
                    <TextInput style={{
                        borderWidth: 1,
                        height: y * 0.08,
                        width: x * 0.8,
                        textAlign: "center",
                        fontSize: 20,
                        borderRadius: 30,
                        backgroundColor: '#FFFFFF50',
                        borderColor: 'rgba(223,34,119,1)'

                    }} onChangeText={(val) => {
                        setLocation(val)
                        nextAnim()
                    }}/>
                    <Animated.View style={{opacity: next.interpolate({inputRange: [0, 1], outputRange: [0.1, 1]})}}>
                        <TouchableOpacity onPress={() =>nextScreen(navigation, id, name, desc, date, location, route)}>
                            <Text style={{
                                textAlign: 'center',
                                marginTop:5,
                                fontSize: 24,
                                color: 'rgba(223,34,119,1)',
                                fontWeight: "bold"
                            }}>Next</Text>
                        </TouchableOpacity>
                    </Animated.View>
                </View>

            </View>
        </ImageBackground>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff'
    },
})

export default Create3Location;


