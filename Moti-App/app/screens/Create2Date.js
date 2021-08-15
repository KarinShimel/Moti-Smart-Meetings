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
    Animated,
    Alert,
    StatusBarIOS,
    LogBox, BackHandler, DatePickerAndroid, ImageBackground
} from 'react-native';
import firebase from "firebase";
import "firebase/firestore";
import {TextInput} from "react-native-gesture-handler";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import DateTimePicker from "react-native-modal-datetime-picker";
import Constants from "expo-constants";
import {Audio} from "expo-av";


let {height, width} = Dimensions.get("window");
const h = height;
const w = width;

function checkValidity(day2, month2, year2, hours2, mins2) {
    if (mins2 === '') {
        return false
    }
    const now = new Date()
    let day = parseInt(day2)
    let month = parseInt(month2)
    let year = parseInt(year2)
    let hours = parseInt(hours2)
    let mins = parseInt(mins2)

    console.log(year, month, day, hours, mins)
    //sanity checks

    const x = new Date(year, month, day, hours, mins)
    return x >= now;
}

function nextScreen(navigation, id, name, desc, day, month, year, hours, mins) {
    if (!checkValidity(day, month, year, hours, mins)) {
        alert('Please enter valid values');
        return
    }
    const date = {day: day, month: month, year: year, hours: hours, mins: mins}
    navigation.navigate('Create3', {id: id, name: name, desc: desc, date: date})
}

const Create2Date = ({navigation, route}) => {
    const [name, setName] = useState(route.params.name);
    const [desc, setDesc] = useState(route.params.desc);
    const [id, setId] = useState(route.params.id);
    const [day, setDay] = useState('');
    const [month, setMonth] = useState('');
    const [year, setYear] = useState('');
    const [hours, setHours] = useState('');
    const [minutes, setMinutes] = useState('');
    const [isDatePickerVisible, setDatePickerVisibility] = useState(false);
    const [titleText, setTitleText] = useState("Pick a Time");
    const showDatePicker = () => {
        setDatePickerVisibility(true);
    };

    const hideDatePicker = () => {
        setDatePickerVisibility(false);
    };

    const handleConfirm = (date) => {

        setDay(date.getDate())
        setMonth(date.getMonth())
        setYear(date.getFullYear())
        setHours(date.getHours())
        setMinutes(date.getMinutes())
        setTitleText(date.getDate().toString() + '/' + (date.getMonth() + 1).toString()
            + '/' + date.getFullYear().toString() + '\t\t' +
            date.getHours().toString() + ':' + date.getMinutes().toString())
        hideDatePicker();
        nextAnim()
    };


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

    const fadeAnim = useRef(new Animated.Value(0)).current
    React.useEffect(() => {
        Animated.timing(
            fadeAnim,
            {
                toValue: 1,
                duration: 1300,
                useNativeDriver: Constants.manifest.extra.animationNativeDriver
            }
        ).start();
    }, [fadeAnim])


    return (
        <ImageBackground source={require('../assets/clocks.jpg')}
                         style={{height: "100%", width: "100%"}}
                         imageStyle={{resizeMode: "cover"}}
        >

            <View style={{
                flex: 1, centerContent: true,  alignItems: 'center',
                backgroundColor: 'rgba(232,255,255,0.8)'
            }}>
                <StatusBar translucent barStyle={'default'} />

                <DateTimePickerModal
                    isVisible={isDatePickerVisible}
                    mode="datetime"
                    value={new Date()}
                    is24Hour={true}
                    onConfirm={handleConfirm}
                    onCancel={hideDatePicker}
                    display="spinner"
                />
                <View style={{alignItems: "center"}}>
                    <Animated.View style={{
                        opacity: fadeAnim,
                        width: "100%",
                        marginTop:h/6

                    }}>

                        <Text
                            style={{fontSize: 30, color: 'rgba(223,34,119,1)', fontWeight: "bold",marginBottom:15}}
                        >{titleText}</Text>
                    </Animated.View>

                    <TouchableOpacity onPress={() => showDatePicker()} style={{
                        backgroundColor: 'rgba(223,34,119,0.9)',
                        justifyContent: 'center',
                        alignContent: 'center',
                        height: 130,
                        width: 130,
                        marginBottom:10,
                        borderRadius: 20
                    }}>
                        <View style={{padding: 15, overflow: "hidden", alignItems: "center"}}>
                            <Image source={require('../assets/clock.png')}
                                   style={{
                                       height: "100%", width: "100%",
                                       resizeMode: "contain", tintColor: 'white'
                                   }}
                            />
                        </View>
                    </TouchableOpacity>

                    <Animated.View style={{opacity:next.interpolate({inputRange:[0,1], outputRange:[0.1,1]})}}>
                        <TouchableOpacity
                            onPress={() =>  nextScreen(navigation, id, name, desc, day, month, year, hours, minutes)}
                            style={{justifyContent: 'center', alignContent: 'center'}}>
                            <Text style={{textAlign:'center', fontSize:24,color:'rgba(223,34,119,1)',fontWeight:"bold"}}>Next</Text>
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

export default Create2Date;
