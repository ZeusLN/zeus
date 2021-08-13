import * as React from 'react';
import {
    StyleSheet,
    Text,
    TextInput,
    View,
    ScrollView,
    TouchableOpacity
} from 'react-native';

export default class EditFee extends React.Component{ 
    render(){
        return(
            <View style ={styles.container}>
                <Text style={styles.maintext}>Edit network fee</Text>
            </View>        
        )
    }            
}
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#242930",
        alignItems:"center",
        justifyContent: "center"
    },
    maintext:{
        color: 'white',
        fontSize:18
    }
})