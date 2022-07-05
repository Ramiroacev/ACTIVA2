import { React, useEffect, useState, useRef, useContext } from "react";
import { StyleSheet, Text, ScrollView, View, TouchableOpacity } from "react-native";
import { WebView } from 'react-native-webview';
import { useUsrCiudadanoFirestore } from "../../customhooks/useUsrCiudadanoFirestore";
import { AuthContext } from "../../contexts/AuthContext";
import { useFirestore } from "../../customhooks/useFirestore";
import constantes from "../../utils/constantes";
import { useNavigation } from "@react-navigation/native";

export default function WebViewAfip() {
    const { setCiudadanoFirestore } = useUsrCiudadanoFirestore()
    const { authContext } = useContext(AuthContext)
    const { setDocumentNoState } = useFirestore()
    const colUsuariosInfo = constantes.colecciones.usuariosInfo;
    const navigation = useNavigation();

    async function onMessage(data) {
        console.log(data)
        let datos = JSON.parse(data.nativeEvent.data)
        console.log('dato', datos)

        if (datos.tipo == 'loginafip') {
            let usuario = datos.usuario

            const dataCiudadano = {
                'id_ciudadano': usuario.id_ciudadano,
                'email': usuario.email_activa,
                'nombres': usuario.apellido + ' ' + usuario.nombre_razon_social,
                'cuitcuil': usuario.cuitcuil
            }

            await setDocumentNoState(colUsuariosInfo, usuario.cuitcuil, {
                'id_ciudadano': usuario.id_ciudadano,
            }).then(() => {

            }).catch((error) => {
                console.log('setDocumentNoState usuario afip: ', error)
                throw error
            });

            await setCiudadanoFirestore(dataCiudadano)

            const loginPayload = {
                email: usuario.email_activa,
                token: usuario.unique_id_loginAfip,
                usuarioInfo: dataCiudadano,
                typeLogin: 'afip'
            }

            authContext.dispatchManual('LOGIN', loginPayload)
        } else if (datos.tipo == 'registro') {
            navigation.navigate('registro')
        }

    }
    const webviewRef = useRef();

    function sendDataToWebView() {
        webviewRef.postMessage('Data from React Native App')
    }

    const runFirst = `
        window.sendDataToReactNativeApp = async () => {
            if(window.location.pathname == '/comercios'){
                //window.ReactNativeWebView.postMessage('/comercios');
                window.location.href = '/afiplogueadoparanative';
            }            
        };
        sendDataToReactNativeApp(); 
        /*setTimeout(function() { 
            sendDataToReactNativeApp(); 
        }, 100);*/
        true; // note: this is required, or you'll sometimes get silent failures
    `;

    const script = () => { `window.alert("Aca!");` }


    return (
        <>
            <WebView
                ref={webviewRef}
                style={styles.container}
                javaScriptEnabledAndroid={true}
                injectJavaScript={sendDataToWebView}
                injectedJavaScript={runFirst}
                onMessage={onMessage}

                source={{ uri: constantes.urls.loginAfip }}
            />
        </>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        marginTop: 20,

    }
})