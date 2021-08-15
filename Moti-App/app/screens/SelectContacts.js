import React, {useEffect, useState} from 'react';
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
    LogBox, BackHandler, DatePickerAndroid, VirtualizedList, ImageBackground
} from 'react-native';
import "firebase/firestore";
import * as Contacts from 'expo-contacts';
import {TextInput} from "react-native-gesture-handler";
import {Audio} from "expo-av";


let {height, width} = Dimensions.get("window");
const y = height
const x = width

const color1 = 'rgba(5,223,215,0.3)'
const color2 = 'rgba(223,34,119,0.8)'


function doneChoosingContacts(navigation, route) {
    if (!(Object.keys(selected).length === 0)) {
        route.params.onGoBack(selected)
        selected = {}
    }
    navigation.goBack()
}

async function getContacts(name) {
    const {status} = await Contacts.requestPermissionsAsync();
    if (status === 'granted') {
        const {data} = await Contacts.getContactsAsync({
            fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name],
            name: name,
        })
        contacts = data.filter(contact => 'phoneNumbers' in contact)
        return contacts
    }
}

function getPureNumber(number) {
    const split = number.split('')
    return split.filter(x => x in [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, '+']).join('')
}


let fillingNumber = 0

function getNumberForItem(data, index) {
    if (index in data) {
        if ('phoneNumbers' in data[index]) {
            return getPureNumber(data[index]['phoneNumbers'][0]['number']);
        }
    }
    fillingNumber += 1
    return fillingNumber
}

const getItem = (data, index) => ({
    name: data[index]['name'],
    number: getNumberForItem(data, index)
});

const getItemCount = (contacts) => contacts.length

function getKey(item) {
    return item.number
}

let contacts = []
let selected = {}

function addRemoveToSelected(name, number) {
    if (!(number in selected)) {
        selected[number] = name
    } else {
        delete selected[number]
    }
}

const SelectContacts = ({navigation, route}) => {
    const [name, setName] = useState('');
    const [dataFlag, setDataFlag] = useState(false);
    const [color, setColor] = useState({})

    // Hiding nav bar
    React.useLayoutEffect(() => {
        navigation.setOptions({headerShown: false});
    }, [navigation]);


    if (!dataFlag) {
        getContacts(name).then(ret => {
            let dict = JSON.parse(JSON.stringify(color))
            ret.forEach(item => {
                //check if contact in dict. if yes - pass. if not - add with gold color
                //console.log(item)
                if ('phoneNumbers' in item) {
                    let number = getPureNumber(item['phoneNumbers'][0]['number'])
                    if (!(number in dict)) {
                        dict[number] = color1
                    }
                }
            })
            setColor(dict)
            setDataFlag(true)
        })
    }

    const Item = ({name, number}) => (
        <View style={{
            flexDirection: 'row',
            backgroundColor: color[number],
            height: height / 11,
            width: 0.8 * width,
            marginVertical: 8,
            marginHorizontal: 16,
            borderRadius: 20
        }}>
            <TouchableOpacity style={{
                flex: 1, justifyContent: 'center',
                alignItems: "center",
            }} onPress={() => {
                addRemoveToSelected(name, number)
                //turn selected to green:
                let colors = JSON.parse(JSON.stringify(color))
                if (colors[number] === color2) {
                    colors[number] = color1
                } else {
                    colors[number] = color2
                }
                setColor(colors)
            }}>
                <Text style={{fontSize: 20}}>{name}</Text>
                <Text style={{fontSize: 20}}>{number}</Text>
            </TouchableOpacity>
        </View>
    );
    return (
        <ImageBackground source={require('../assets/watercolor.jpg')} imageStyle={{
            resizeMode: "cover"
        }}
                         style={{height: "100%", width: "100%",}}>
            <View style={{...styles.container, backgroundColor: 'rgba(232,255,255,0.75)',}}>
                <StatusBar translucent barStyle={'default'} />
                <Text style={{
                    textAlign: 'center',
                    fontSize: 30,
                    color: 'rgba(223,34,119,1)',
                    fontWeight: "bold"
                }}
                >Choose Contacts</Text>

                <View style={{marginTop: 15, flex: 0.9, alignItems: 'center'}}>
                    <TextInput style={{
                        borderWidth: 1,
                        height: y * 0.08,
                        width: x * 0.9,
                        borderColor:  'rgba(223,34,119,1)',
                        textAlign: "center",
                        fontSize: 20,
                        borderRadius: 20
                    }} placeholder={'Search'} onChangeText={(val) => {
                        setName(val);
                        setDataFlag(false)
                    }}/>
                    <VirtualizedList
                        data={contacts}
                        initialNumToRender={4}
                        renderItem={({item}) => <Item name={item.name} number={item.number}/>}
                        keyExtractor={item => getKey(item)}
                        getItemCount={getItemCount}
                        getItem={getItem}
                        style={{marginTop: 10}}
                        keyboardShouldPersistTaps={'handled'}
                    />
                </View>

                {/*<View style={{flex:0.1}}>*/}
                {/*    <TouchableOpacity onPress={() => doneChoosingContacts(navigation,route)} style={{backgroundColor:'grey', flex:1,justifyContent:'center',alignContent:'center'}}>*/}
                {/*        <Text style={{textAlign:'center', fontSize:24}}>Done</Text>*/}
                {/*    </TouchableOpacity>*/}
                {/*</View>*/}
                <TouchableOpacity onPress={() => doneChoosingContacts(navigation, route)}
                                  style={{
                                      borderRadius: 20,
                                      backgroundColor: 'rgba(255,255,255,0.2)',
                                      borderColor: 'rgba(223,34,119,1)',
                                      width: "80%",
                                      height: height / 12,
                                      alignSelf: "center",
                                      justifyContent: "center",
                                      borderWidth:1
                                  }}>
                    <Text style={{
                        textAlign: 'center',
                        fontSize: 24,
                        color: 'rgba(223,34,119,1)',
                        fontWeight: "bold",

                    }}>Done</Text>
                </TouchableOpacity>
            </View>
        </ImageBackground>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingTop: y / 12
    },
    item: {
        flexDirection: 'row',
        height: 0.06 * height,
        width: 0.8 * width,
        marginVertical: 8,
        marginHorizontal: 16,
    }
})

export default SelectContacts;


