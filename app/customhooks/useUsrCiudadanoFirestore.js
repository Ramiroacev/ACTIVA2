import { useState } from "react";
import { useFirestore } from "./useFirestore";
import constantes from "../utils/constantes";
import { getAuth, createUserWithEmailAndPassword, updateProfile, deleteUser, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { OperationCanceledException } from "typescript";

export const useUsrCiudadanoFirestore = () => {
    const auth = getAuth()
    const { data: dataUsr, error: errorUsr, loading: loadingUsr, getDataDoc, returnGetDataDoc, setDocumentNoState } = useFirestore()
    const { setDocument, deleteDocument } = useFirestore()


    const colUsuariosInfo = constantes.colecciones.usuariosInfo
    const colCiudadanos = constantes.colecciones.ciudadanos

    const getUsuario = async () => {
        getDataDoc(colUsuariosInfo, auth.currentUser.uid)
    }

    const getReturnUsuario = async () => {
        return returnGetDataDoc(colUsuariosInfo, auth.currentUser.uid)
    }

    const iniciarSesionEmailYPass = async (email, password) => {
        try {
            let resultado = null
            let usuarioInfo = null
            let ciudadanoInfo = null

            await signInWithEmailAndPassword(
                auth,
                email,
                password,
            )
            console.log('AUTHfirebase', auth.currentUser)

            usuarioInfo = await returnGetDataDoc(colUsuariosInfo, auth.currentUser.uid)
            ciudadanoInfo = await returnGetDataDoc(colCiudadanos, usuarioInfo.id_ciudadano)
            usuarioInfo = { ...usuarioInfo, ...ciudadanoInfo }

            //await returnGetDataDoc(colUsuariosInfo, auth.currentUser.uid)

            resultado = {
                email: email,
                token: auth.currentUser.stsTokenManager.accessToken,
                usuarioInfo: usuarioInfo
            }

            return resultado
        } catch (error) {
            console.log('error desde useUsrCiudadanoFirestore iniciarSesionEmailYPass', error)
            throw error
        }
    }

    const crearUsuarioEmailYPassConCiudadano = async (email, password, PimUsuario) => {
        try {
            await createUserWithEmailAndPassword(auth, email, password)
                .then((userCredential) => {

                })
                .catch((error) => {
                    console.log('error desde useUsrCiudadanoFirestore.js createUserWithEmailAndPassword', error);
                    throw error
                });


            await updateProfileAuth(PimUsuario.nombres)

            await setUsuarioFirestore(PimUsuario.id_ciudadano)

            await setCiudadanoFirestore(PimUsuario)



        } catch (error) {
            cerrarSesionAuth()
            console.log('error desde useUsrCiudadanoFirestore.js crearUsuarioEmailYPassConCiudadano', error)
            throw error
        }
    }

    const cerrarSesionAuth = () => {
        signOut(auth)
    }

    const eliminarUsuarioEnAuthYFirestore = async () => {
        try {
            const uid = getAuth().currentUser.uid
            await deleteUser(getAuth().currentUser)
            await deleteDocument(colUsuariosInfo, uid)
        } catch (error) {
            console.log('error desde useUsrCiudadanoFirestore.js eliminarUsuarioEnAuthYFirestore', error)
            throw error
        }
    }

    const setUsuarioFirestore = async (id_ciudadano) => {
        await setDocumentNoState(colUsuariosInfo, getAuth().currentUser.uid, {
            'id_ciudadano': id_ciudadano,
        }).then(() => {

        }).catch((error) => {
            console.log('setDocument setUsuarioFirestore: ', error);
            throw error
        });
    }

    const setCiudadanoFirestore = async (PimUsuario) => {
        console.log('PimUsuario', PimUsuario)
        await setDocumentNoState(colCiudadanos, PimUsuario.id_ciudadano, {
            'nombres': PimUsuario.nombres,
            'cuitcuil': PimUsuario.cuitcuil,
            'email': PimUsuario.email
        }).then(() => {

        }).catch((error) => {
            console.log('setDocument setCiudadanoFirestore: ', error);
            throw error
        });
    }

    const updateProfileAuth = async (nombres) => {
        await updateProfile(getAuth().currentUser, { displayName: nombres }).then(() => {
            // Profile updated!            
            // ...
        }).catch((error) => {
            console.log('error updateProfileAuth', error);
            throw error
        });
    }

    return {
        dataUsr,
        errorUsr,
        loadingUsr,
        getUsuario,
        iniciarSesionEmailYPass,
        getReturnUsuario,
        crearUsuarioEmailYPassConCiudadano,
        eliminarUsuarioEnAuthYFirestore,
        cerrarSesionAuth,
        updateProfileAuth,
        setUsuarioFirestore,
        setCiudadanoFirestore,
    }
}