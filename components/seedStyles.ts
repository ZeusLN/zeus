import { StyleSheet } from 'react-native';

import { themeColor } from '../utils/ThemeUtils';

export const buttonContainerStyle = () =>
    ({
        alignSelf: 'center',
        marginTop: 45,
        bottom: 35,
        backgroundColor: themeColor('background'),
        width: '100%'
    } as const);

export default StyleSheet.create({
    blackText: {
        color: 'black',
        fontFamily: 'PPNeueMontreal-Book'
    },
    button: {
        paddingTop: 10,
        paddingBottom: 10,
        width: 350,
        alignSelf: 'center'
    },
    modal: {
        margin: 20,
        backgroundColor: 'white',
        borderRadius: 35,
        padding: 35,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5
    },
    centeredView: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 22
    },
    column: {
        marginTop: 8,
        flexWrap: 'wrap',
        alignItems: 'flex-start',
        alignSelf: 'center',
        flexDirection: 'column',
        width: '50%'
    }
});
