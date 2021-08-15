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
    ImageBackground
} from 'react-native';
import { useDimensions, useDeviceOrientation} from '@react-native-community/hooks';
import { NavigationContainer } from '@react-navigation/native';
import {createStackNavigator} from '@react-navigation/stack';
import { color } from 'react-native-reanimated';
import {getTimeFromTimestamp} from "./MainScreen";
import firebase from "firebase";
import Constants from "expo-constants";

const firebaseConfig = Constants.manifest.extra.firebaseConfig
if (firebase.apps.length === 0) {
    firebase.initializeApp(firebaseConfig);
}

const db = firebase.firestore()
const meetings = db.collection('meetings')

function goReviewPage(nav,id){
    let y = null
    DATA.forEach(x => {if(x['id']===id){y=x}})
    nav.navigate('Review',{data:y})
}

async function getMeetings(user){
    //get all meetings of user sorted
    const now = firebase.firestore.Timestamp.now()
    let op = '<'
    await meetings.where('participants', 'array-contains', user)
        .where('date', op, now)
        .orderBy('date', 'desc')
        .get().then(querySnapshot => {
        querySnapshot.forEach((doc) => {
            //console.log(doc.id, ' => ', doc.data());
            let x = doc.data()
            x['id'] = doc.id
            DATA.push(x)
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

const Item = ({ name,date,id,nav}) => (
    <View style={styles.item}>
        <TouchableOpacity style={{flex:1, justifyContent: 'center',
            alignItems: "center",}} onPress={() => goReviewPage(nav,id)}>
            <Text style={{fontSize:22,textAlign: 'center',color: 'rgb(67,194,232)',fontWeight:"bold"}}>{name}</Text>
            <Text style={{fontSize:20,textAlign: 'center'}}>{date}</Text>
        </TouchableOpacity>
    </View>
);

let counter = 0
function getKey(){
    counter+=1
    return counter.toString()
}

const MeetingsScreen = ({navigation,route}) => {


    const [getData, setgetData] = useState(false);

    // Hiding nav bar
    React.useLayoutEffect(() => {
        navigation.setOptions({headerShown: false});
    }, [navigation]);
    if(!getData){
        DATA = []
        counter = 0
        getMeetings(route.params.id).then(ret => {setgetData(ret)})
    }
    if(!getData){return null}
    return (
        <ImageBackground source={require('../assets/jellyfish.jpg')}
                         style={{height: "100%", width: "100%"}}
                         imageStyle={{resizeMode: "cover"}}>
        <View style={styles.container}>
            <Text style={{textAlign: 'center', fontSize: 40,fontWeight:"bold",color: 'rgba(223,34,119,1)'}}>History</Text>
            <VirtualizedList
                data={DATA}
                initialNumToRender={4}
                renderItem={({ item }) => <Item name={item.name} date={item.date} id={item.id} nav={navigation}/>}
                keyExtractor={item => getKey()}
                getItemCount={getItemCount}
                getItem={getItem}
                style={{marginTop:10}}
            />
        </View>
        </ImageBackground>
    );
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
    container:{
        paddingTop: 40,
        flex:1,
        alignContent: "center",
        backgroundColor: 'rgba(232,255,255,0.7)'
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
        borderRadius: 30,
        backgroundColor: 'rgba(255,255,255,0.5)',
        borderColor: 'rgba(223,34,119,1)',
        marginVertical: 8,
        marginHorizontal: 16,
    },
    title: {
        fontSize: 26,
    }
})
export default MeetingsScreen;
