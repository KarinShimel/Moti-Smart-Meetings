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
import {Audio} from "expo-av";

let SERVER_IP_ADDRESS = Constants.manifest.extra.SERVER_IP_ADDRESS
const PORT = Constants.manifest.extra.PORT

const firebaseConfig = Constants.manifest.extra.firebaseConfig
if (firebase.apps.length === 0) {
    firebase.initializeApp(firebaseConfig);
}

const db = firebase.firestore()
const creds = db.collection('unicorns')

function goSuggestPage(place,navigation,id){
    // create meeting and then nav to suggest
    try {
        const location = JSON.stringify(place)
        const url = 'http://'+SERVER_IP_ADDRESS+':'+PORT+'/scrap_meeting2?id='+id+'&location='+location
        fetch(url)
            .then(response => {
                if(response.status!==200){alert('Something went wrong, please try again later');return null}
                return response.json()
            })
            .then(response => {
                if (response == null){return}
                navigation.navigate('Suggest',{meet:response,id:id})
            })
    }catch (e){console.log('error connecting to server')}
}

const getItem = (data, index) => ({
    name: data[index]['name'],
    address: data[index]['address'],
    tags: data[index]['tags']
});

const getItemCount = (data) => data.length;

const Item = ({name,address,tags,nav,id}) => (
    <View style={styles.item}>
        <TouchableOpacity style={{flex:1, justifyContent: 'center',
            alignItems: "center",}} onPress={() => goSuggestPage({name:name,address:address,tags:tags},nav,id)}>
            <Text style={{fontSize:25,textAlign: 'center',color: 'rgb(182,34,223)',fontWeight:"bold"}}>{name}</Text>
            <Text style={{fontSize:20,textAlign: 'center'}}>{address}</Text>
            <Text style={{fontSize:20,textAlign: 'center'}}>{tags.toString()}</Text>
        </TouchableOpacity>
    </View>
);

let counter = 0
function getKey(){
    counter+=1
    return counter.toString()
}

const PlacesScreen = ({navigation,route}) => {
    // Hiding nav bar
    React.useLayoutEffect(() => {
        navigation.setOptions({headerShown: false});
    }, [navigation]);

    React.useEffect(() => {
        const doc = creds.doc('server_ip').get().then(ret => {
            SERVER_IP_ADDRESS = ret.data()['ip']
        })
    });


    return (
        <ImageBackground source={require('../assets/ocean.jpg')}
                         style={{height: "100%", width: "100%"}}
                         imageStyle={{resizeMode: "cover"}}>
        <View style={styles.container}>
            <StatusBar translucent barStyle={'default'} />
            <Text style={{textAlign: 'center', fontSize: 24,fontWeight:"bold",color: 'rgba(223,34,119,1)'}}>Pick a place</Text>
            <VirtualizedList
                data={route.params.places}
                initialNumToRender={4}
                renderItem={({ item }) => <Item name={item.name} address={item.address} tags={item.tags} nav={navigation} id={route.params.id}/>}
                keyExtractor={item => getKey()}
                getItemCount={getItemCount}
                getItem={getItem}
                style={{marginTop:10}}
            />
        </View>
        </ImageBackground>
    );
}
const styles = StyleSheet.create({
    container:{
        paddingTop: 50,
        flex:1,
        alignContent: "center",
        backgroundColor: 'rgba(232,255,255,0.5)',

    },
    name:{
        flex:0.7,
        justifyContent: "center",
        alignItems: "center",
        fontSize: 15,

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
        alignItems: "center",

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
export default PlacesScreen;
