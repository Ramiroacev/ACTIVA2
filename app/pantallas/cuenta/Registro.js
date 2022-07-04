import React, { useEffect, useContext, useState, useRef } from "react"
import { ScrollView, StyleSheet, View } from "react-native";

import { Text, Icon, Input, Button } from "react-native-elements";
import { getAuth, createUserWithEmailAndPassword, updateProfile, deleteUser, PhoneAuthProvider, fetchSignInMethodsForEmail, signInWithCredential, sendEmailVerification } from 'firebase/auth'
import { getApp, initFirebase } from "../../utils/firebase-config"
import * as Yup from 'yup'
import { Formik } from 'formik'
import DateTimePickerModal from "react-native-modal-datetime-picker";
import { FirebaseRecaptchaVerifierModal } from 'expo-firebase-recaptcha';
import { AuthContext } from "../../contexts/AuthContext";
import axios from 'axios';
import useAxiosNoToken from "../../customhooks/useAxiosNoToken";
import stylesGral from "../../utils/StyleSheetGeneral";
import TextInputFmk from "../../componentes/TextInputFmk";
import SubmitBtnFmk from "../../componentes/SubmitBtnFmk";
import Loading from "../../componentes/Loading";
import ModalComp from "../../componentes/ModalComp";
import { useNavigation } from "@react-navigation/native";

import estilosVar from "../../utils/estilos";
import { cuilValidator, expRegulares } from "../../utils/validaciones";
import { useTraducirFirebaseError } from "../../customhooks/useTraducirFirebaseError";
import { useFirestore } from "../../customhooks/useFirestore";
import constantes from "../../utils/constantes";
import RegistroGoogle from "./RegistroGoogle"
import moment from 'moment';
import { useUsrCiudadanoFirestore } from "../../customhooks/useUsrCiudadanoFirestore";

export default function Registro({ route }) {
    const { authContext } = useContext(AuthContext);
    const app = getApp();
    const auth = getAuth(initFirebase);
    const navigation = useNavigation();

    const registroInitialState = {
        nombre: '',
        apellido: '',
        dni: null,
        cuitcuil: null,
        email: '',
        celular: '',
        fechaNacimiento: '',
        confirmaPass: '',
    }
    const [dataRegistro, setDataRegistro] = useState(registroInitialState)
    const [pedir, setPedir] = useState(0)
    const [pedirCiud, setPedirCiud] = useState(0)

    const { setDocument, deleteDocument, setDocumentNoState } = useFirestore()

    const colUsuariosInfo = constantes.colecciones.usuariosInfo;
    const [idVerificacion, setIdVerificacion] = useState(null)
    const [codigo, setCodigo] = useState(null);
    const [userExistPhone, setUserExistPhone] = useState({ existe: false, idUser: null, currentUser: null });
    const [correoVerificar, setCorreoVerificar] = useState(null);

    const { state: firebaseError, dispatch: dispatchFirebaseError } = useTraducirFirebaseError()
    const { state: verifCelularError, dispatch: dispatchCelularError } = useTraducirFirebaseError()
    const { state: emailExisteError, dispatch: dispatchEmailExisteError } = useTraducirFirebaseError()

    const { eliminarUsuarioEnAuthYFirestore, setCiudadanoFirestore, setUsuarioFirestore, updateProfileAuth } = useUsrCiudadanoFirestore()

    const { res, err, loading, refetch } = useAxiosNoToken({
        method: 'post',
        url: '/registrarCiudadano',
        data: dataRegistro
    })

    const Inputs = {
        nombre: useRef(null),
        apellido: useRef(null),
        dni: useRef(null),
        cuitcuil: useRef(null),
        email: useRef(null),
        celular: useRef(null),
        fechaNacimiento: useRef(null),
        pass: useRef(null),
        confirmaPass: useRef(null)
    }

    const { user_data } = route.params ? route.params : false;
    // user_data && console.log("Param",user_data)

    const [showPassword1, setShowPassword1] = useState(true)
    const [showPassword2, setShowPassword2] = useState(true)
    //const [errorExistInFirebase, setErrorExistInFirebase] = useState({ message: "", errorShow: false });
    const recaptchaVerifier = useRef(null);
    const [dataPicker, setDataPicker] = useState(false)
    const [datePlaceHolder, setDatePlaceHolder] = useState(null)
    const [visibleModalPhone, setVisibleModalPhone] = useState(false)
    const [visibleModalUsuarioExiste, setVisibleModalUsuarioExiste] = useState(false)



    const handleDatePicker = () => setDataPicker(!dataPicker)
    const handleConfirm = (date) => {
        console.log(moment(date).format("DD/MM/YYYY"));
        dataRegistro.fechaNacimiento = moment(date).format("DD/MM/YYYY")

        handleDatePicker()
    }

    const sEsRequerido = 'Es Requerido';
    const registroValidationSchema = Yup.object({
        nombre: Yup.string().trim().min(2, 'Nombre demasiado corto').required(sEsRequerido),
        apellido: Yup.string().trim().required(sEsRequerido),
        dni: Yup.number().typeError('Ingrese solo números').required(sEsRequerido).test("dni_valido", "El DNI no es válido", val => expRegulares.dni.test(val)),
        cuitcuil: Yup.number().typeError('Ingrese solo números').required(sEsRequerido).test("cuil_valido", "El CUIL no es válido", (val) => (val !== undefined) && cuilValidator(val.toString())),
        email: Yup.string().email('Indique un email válido').required(sEsRequerido),
        celular: Yup.number().typeError('Ingrese solo números').required("Es Requerido").test("celular", 'Ingrese un celular correcto.', (val) => (val !== undefined) && expRegulares.cel.test(val.toString())),
        fechaNacimiento: Yup.date().typeError('').required(sEsRequerido).max(new Date(), `Verifica si es menor a la fecha actual`),
        pass: Yup.string().min(6, 'Mínimo 6 caracteres').required(sEsRequerido),
        confirmaPass: Yup.string().oneOf([Yup.ref('pass')], 'No coincide la contraseña')

    })

    useEffect(async () => {
        route.params?.user_data && setUserProvider(route.params?.user_data.providerData);

        if (userExistPhone.existe) {
            const auth = getAuth();
            if (dataRegistro.celular && dataRegistro.celular !== null) {
                const phoneProvider = new PhoneAuthProvider(auth);
                const verificationId = await phoneProvider.verifyPhoneNumber("+54" + dataRegistro.celular, recaptchaVerifier.current);
                console.log('verificationId', verificationId)
                verificationId && setIdVerificacion(verificationId);

                setVisibleModalPhone(true);
            }
        } else {
            if (pedir > 0) {
                const registrar = async () => {
                    dispatchFirebaseError(false);
                    try {
                        await createUserWithEmailAndPassword(auth, dataRegistro.email, dataRegistro.pass).then((userCredential) => {
                            console.log("Crear usuario con contraseña:", userCredential);
                            if (userCredential) {
                                setCorreoVerificar(dataRegistro.email);
                                refetch()
                            }
                        });
                    } catch (error) {
                        dispatchFirebaseError({ type: error.code });
                        console.log("Error", error)
                        console.log("Usuario con proveedor teléfono", userExistPhone.currentUser);
                        //Borro usuario celular
                        deleteUser(userExistPhone.currentUser).then((res) => {
                            setVisibleModalPhone(false);
                        })
                    }
                }
                registrar()
            }
        }
    }, [pedir])

    useEffect(() => {
        const effectRes = async () => {
            //console.log(res)
            let flagError = false;
            if (typeof res.data !== 'undefined') {
                if (res.data.success) {
                    //console.log('registro', res.data.data.registro)
                    if (res.data.data.registro === 'OK') {
                        try {
                            let sId_ciudadano = res.data.data.id_ciudadano.toString()
                            const auth = getAuth();
                            const dataCiudadano = {
                                'id_ciudadano': sId_ciudadano,
                                'email': dataRegistro.email,
                                'nombres': dataRegistro.nombre,
                                'apellido': dataRegistro.apellido,
                                'cuitcuil': dataRegistro.cuitcuil
                            }


                            await sendEmailVerification(auth.currentUser).then(res => {
                                if (res === undefined) {
                                    console.log(res);
                                }
                            })

                            await updateProfileAuth(dataRegistro.apellido + ' ' + dataRegistro.nombre)

                            await setUsuarioFirestore(res.data.data.id_ciudadano)

                            await setDocumentNoState(colUsuariosInfo, userExistPhone.idUser, {
                                'id_ciudadano': res.data.data.id_ciudadano,
                            }).then(() => {

                            }).catch((error) => {
                                console.log('setDocumentNoState usuario celular: ', error);
                                throw error
                            });

                            await setCiudadanoFirestore(dataCiudadano)

                            const loginPayload = {
                                email: dataRegistro.email,
                                token: auth.currentUser.stsTokenManager.accessToken,
                                usuarioInfo: dataCiudadano
                            }

                            authContext.dispatchManual('LOGIN', loginPayload)
                        } catch (error) {
                            console.log('Error Registro effectRes', error)

                        }
                    } else {
                        flagError = true
                    }
                } else {
                    flagError = true
                }
            }

            if (flagError) {
                eliminarUsuarioEnAuthYFirestore()

                deleteUser(userExistPhone.currentUser).then((res) => {
                    //setVisibleModalPhone(false);
                })
            }

        }

        effectRes()
    }, [res])

    const verificarSiExiste = async (valor, hayError, tipo) => {
        if (hayError === undefined) {
            tipo === "email" && console.log("Es un dato validado", valor)
            if (tipo === "email") {

                fetchSignInMethodsForEmail(auth, valor).then(res => {
                    /* Devuelve s/ proveedor: Array [ "google.com", o "password" ] */
                    if (res.length !== 0) {
                        dispatchEmailExisteError({ type: 'Email utilizado en otra cuenta' })
                    } else {
                        dispatchEmailExisteError({ type: null });
                    }
                })
            } else {
                const credential = PhoneAuthProvider.credential(idVerificacion, codigo);
                await signInWithCredential(auth, credential).then(async (res) => {
                    console.log("Nuevo usuario:", res);
                    if (!res._tokenResponse.isNewUser) {
                        dispatchCelularError({ type: 'Celular utilizado por otra cuenta' })
                    } else {
                        dispatchCelularError({ type: null })
                        setUserExistPhone({ existe: false, idUser: res.user.uid, currentUser: res.user })
                        setVisibleModalPhone(false)
                        //vuelvo a ejecutar el registro pero esta vez pasa a registrar usuario en firebase
                        setPedir(pedir + 1);
                    }
                }).catch((error) => {
                    dispatchCelularError({ type: error.code })
                });
            }
        }
    }

    const handleEditDni = async (values) => {
        //values.nombre = 'asasas'
        try {
            const CiudParaAutocompletar = await axios.post(constantes.API + 'buscarCiudParaAutocompletar', { dni: values.dni })
            //console.log('CiudParaAutocompletar', CiudParaAutocompletar.data)
            if (CiudParaAutocompletar.data.data !== null) {
                let AutoCiud = CiudParaAutocompletar.data.data
                console.log('AutoCiud', AutoCiud)

                if (typeof AutoCiud['id_usuario'] !== 'undefined') {
                    if (AutoCiud['id_usuario'] !== null) {
                        setVisibleModalUsuarioExiste(true)
                        return
                    }
                }

                values.nombre = AutoCiud['nombre']
                values.apellido = AutoCiud['apellido']
                values.cuitcuil = AutoCiud['cuitcuil']
                values.celular = AutoCiud['telefono']
                values.fechaNacimiento = AutoCiud['fecha_nacimiento']
                values.email = AutoCiud['email_activa']
                Inputs.cuitcuil.current.focus()
                Inputs.cuitcuil.current.focus()
                //doble para que impacte el autocompletado

            }
        } catch (error) {
            console.log('err', error)
        }
    }

    const submitRegistro = (values, formikActions) => {
        //console.log('submitRegistro')
        console.log('emailExisteError', emailExisteError)
        console.log('emailExisteError', verifCelularError)
        if (!emailExisteError) {
            setDataRegistro(values)
            setUserExistPhone({ existe: true, idUser: null, currentUser: null })

            setPedir(pedir + 1)
        }
        formikActions.setSubmitting(false)
    }

    return (
        <ScrollView style={stylesGral.formContainer}  >
            <Text h4 style={styles.titulo} >Registrate en GualeActiva</Text>
            {!user_data ? //&& !stateModal.modalPhone ?
                <Formik initialValues={registroInitialState} validationSchema={registroValidationSchema} onSubmit={submitRegistro}>
                    {({ values, isSubmitting, errors, touched, isValid, handleBlur, handleChange, handleSubmit }) => (
                        <>
                            <TextInputFmk
                                name="dni"
                                placeholder="Número de documento"
                                slabel="Número de documento"
                                error={touched.dni && errors.dni}
                                onChangeText={handleChange('dni')}
                                onBlur={handleBlur('dni')}
                                value={values.dni}
                                keyboardType='number-pad'
                                ref={Inputs.dni}
                                onSubmitEditing={() => { handleEditDni(values);Inputs.cuitcuil.current.focus() }} blurOnSubmit={false}
                            />
                            <TextInputFmk
                                name="cuitcuil"
                                placeholder="Cuit/Cuil"
                                slabel="Cuit/Cuil"
                                error={touched.cuitcuil && errors.cuitcuil}
                                onChangeText={handleChange('cuitcuil')}
                                onBlur={handleBlur('cuitcuil')}
                                value={values.cuitcuil}
                                keyboardType='number-pad'
                                ref={Inputs.cuitcuil}
                                onSubmitEditing={() => { Inputs.nombre.current.focus(); }} blurOnSubmit={false}
                            />
                            <TextInputFmk
                                name="nombre"
                                placeholder="Nombre"
                                slabel="Nombre"
                                error={touched.nombre && errors.nombre}
                                onChangeText={handleChange('nombre')}
                                onBlur={handleBlur('nombre')}
                                value={values.nombre}
                                ref={Inputs.nombre}
                                onSubmitEditing={() => { Inputs.apellido.current.focus(); }} blurOnSubmit={false}
                            />
                            <TextInputFmk
                                name="apellido"
                                placeholder="Apellido"
                                slabel="Apellido"
                                error={touched.apellido && errors.apellido}
                                onChangeText={handleChange('apellido')}
                                onBlur={handleBlur('apellido')}
                                value={values.apellido}
                                ref={Inputs.apellido}
                                onSubmitEditing={() => { Inputs.email.current.focus(); }} blurOnSubmit={false}
                            />

                            <TextInputFmk
                                name="email"
                                placeholder="Email"
                                slabel="Email"
                                error={touched.email && errors.email}
                                onChangeText={handleChange('email')}
                                onBlur={handleBlur('email')}
                                onEndEditing={(e) => verificarSiExiste(e.nativeEvent.text, errors.email, "email")}
                                value={values.email}
                                ref={Inputs.email}
                                onSubmitEditing={() => { Inputs.celular.current.focus(); }} blurOnSubmit={false}
                            />
                            {(emailExisteError) ?
                                <>
                                    <Text>err emailExisteError</Text>
                                    <Text style={stylesGral.errorText}>{JSON.stringify(emailExisteError)}</Text>
                                </>
                                : null
                            }
                            <TextInputFmk
                                name="celular"
                                placeholder="Celular"
                                slabel="Celular"
                                error={touched.celular && errors.celular}
                                onChangeText={handleChange('celular')}
                                onBlur={handleBlur('celular')}
                                value={parseInt(values.celular[0]) === 0 ? values.celular.slice(1) : values.celular}
                                onEndEditing={(e) => {/*verificarSiExiste(e.nativeEvent.text, errors.celular, "celular")*/ }}
                                keyboardType='number-pad'
                                ref={Inputs.celular}
                                onSubmitEditing={() => { Inputs.fechaNacimiento.current.focus(); }} blurOnSubmit={false}
                            />
                            <View style={stylesGral.info}>
                                <View style={styles.iconRow}>
                                    <Icon style={styles.styleIcon} name='information' type='material-community' color={estilosVar.naranjaBitter} />
                                    <Text style={styles.textInfo}>Código de área sin "0" + Teléfono sin "15"</Text>
                                </View>
                            </View>
                            {(verifCelularError) ?
                                <>
                                    <Text>err verifCelularError</Text>
                                    <Text style={stylesGral.errorText}>{JSON.stringify(verifCelularError)}</Text>
                                </>
                                : null
                            }
                            <TextInputFmk
                                name="fechaNacimiento"
                                placeholder={datePlaceHolder ? datePlaceHolder : "Fecha Nacimiento"}
                                slabel="Fecha Nacimiento"
                                error={touched.fechaNacimiento && errors.fechaNacimiento}
                                onChangeText={handleChange('fechaNacimiento')}
                                onBlur={handleBlur('fechaNacimiento')}
                                value={values.fechaNacimiento}
                                rightIcon={
                                    <Icon
                                        type="material-community"
                                        name={values.fechaNacimiento ? "calendar-check" : "calendar-blank"}
                                        color={values.fechaNacimiento ? estilosVar.colorIconoActivo : estilosVar.colorIconoInactivo}
                                        onPress={handleDatePicker}
                                    />
                                }
                                ref={Inputs.fechaNacimiento}
                                onSubmitEditing={() => { Inputs.pass.current.focus(); }} blurOnSubmit={false}
                            />
                            {dataPicker &&
                                <DateTimePickerModal
                                    isVisible={dataPicker}
                                    mode="date"
                                    onConfirm={handleConfirm}
                                    onCancel={handleDatePicker}
                                />
                            }
                            <TextInputFmk
                                name="pass"
                                placeholder="Contraseña"
                                slabel="Contraseña"
                                error={touched.pass && errors.pass}
                                onChangeText={handleChange('pass')}
                                onBlur={handleBlur('pass')}
                                value={values.pass}
                                secureTextEntry={(showPassword1) ? true : false}
                                rightIcon={
                                    <Icon
                                        type="material"
                                        name={showPassword1 ? "visibility-off" : "visibility"}
                                        onPress={() => setShowPassword1(!showPassword1)}
                                    />
                                }
                                ref={Inputs.pass}
                                onSubmitEditing={() => { Inputs.confirmaPass.current.focus(); }} blurOnSubmit={false}
                            />
                            <TextInputFmk
                                name="confirmaPass"
                                placeholder="Confirma Contraseña"
                                slabel="Confirma Contraseña"
                                error={touched.confirmaPass && errors.confirmaPass}
                                onChangeText={handleChange('confirmaPass')}
                                onBlur={handleBlur('confirmaPass')}
                                value={values.confirmaPass}
                                secureTextEntry={(showPassword2) ? true : false}
                                rightIcon={
                                    <Icon
                                        type="material"
                                        name={showPassword2 ? "visibility-off" : "visibility"}
                                        onPress={() => setShowPassword2(!showPassword2)}
                                    />
                                }
                                ref={Inputs.confirmaPass}
                            />
                            <SubmitBtnFmk submitting={isSubmitting} onPress={handleSubmit} title='Registrarme' disable={isValid} />
                            {(err) ?
                                <>
                                    <Text>Err axios</Text>
                                    <Text style={stylesGral.errorText}>{JSON.stringify(err)}</Text>
                                </>
                                : null
                            }
                            {(typeof res.data !== 'undefined') ?
                                (!res.data.success) ?
                                    <>
                                        <Text>err res</Text>
                                        <Text style={stylesGral.errorText}>{res.data.error}</Text>
                                    </>
                                    : null
                                : null
                            }
                            {(firebaseError) ?
                                <>
                                    <Text>err firebase</Text>
                                    <Text style={stylesGral.errorText}>{JSON.stringify(firebaseError)}</Text>
                                </>
                                : null
                            }
                            <FirebaseRecaptchaVerifierModal
                                ref={recaptchaVerifier}
                                firebaseConfig={app.options}
                            />
                        </>
                    )}
                </Formik>
                : <RegistroGoogle userProvider={user_data} refetch={refetch} />
            }
            {visibleModalPhone &&
                <ModalComp stateModal={visibleModalPhone} setModalState={setVisibleModalPhone} titulo="Verificar telefono">
                    <View style={styles.modal}>
                        <Text>Ingrese el codigo recibido</Text>
                        <Input
                            style={styles.inputFormModal}
                            placeholder="Codigo"
                            containerStyle={styles.inputForm}
                            rightIcon={
                                <Icon type="material-community" name="cellphone-message" iconStyle={styles.iconRight} />
                            }
                            onChange={(e) => setCodigo(e.nativeEvent.text)}
                        />
                        <Button title="Verificar codigo" onPress={verificarSiExiste} style={styles.btnRegister} />
                        {(verifCelularError) ?
                            <>
                                <Text>err verifCelularError</Text>
                                <Text style={stylesGral.errorText}>{JSON.stringify(verifCelularError)}</Text>
                            </>
                            : null
                        }
                    </View>
                </ModalComp>
            }

            {visibleModalUsuarioExiste &&
                <ModalComp stateModal={visibleModalUsuarioExiste} setModalState={setVisibleModalUsuarioExiste} ocultarIconClose={true} titulo="Ciudadano Registrado en GualeActiva">
                    <View style={styles.modal}>
                        <Text>El Ciudadano indicado ya posee usuario en GualeActiva, utilice sus credenciales con normalidad</Text>
                        <Text>{'\n'}</Text>
                        <Text style={[styles.btnRegister, styles.titulo]} onPress={() => navigation.navigate("Login")} > Ir al Login </Text>
                    </View>
                </ModalComp>
            }
            <Text>{pedir}</Text>

            {loading ? (
                <Loading isLoading={true} text={"Consultando..."} />
            ) : null}
        </ScrollView>
    )

}

const styles = StyleSheet.create({
    titulo: {
        textAlign: 'center',
        marginBottom: 30,
        marginTop: 30
    },
    info: {
        width: 295,
        height: 41,
        flexDirection: "row",
    },
    iconRow: {
        height: 41,
        flexDirection: "row",
        flex: 1,
        marginBottom: 10,
        marginTop: -10
    },
    styleIcon: {
        fontSize: 30,
        width: 40,
        height: 41
    },
    textInfo: {
        height: 29,
        width: 265,
    },
    errorExistInFirebase: {
        marginTop: -10,
        marginLeft: 10,
        marginBottom: 20,
        color: estilosVar.rojoCrayola
    },
    errorExistInFirebaseModal: {
        marginTop: 10,
        marginLeft: 10,
        marginBottom: 20,
        color: estilosVar.rojoCrayola
    },
    inputForm: {
        width: "100%",
        marginTop: 20,
    },
    btnRegister: {
        color: estilosVar.azulSuave,
        fontWeight: "bold",
    },

    // Modal
    modal: {
        margin: 20
    },
    inputFormModal: {
        width: "100%",
    },
    correo: {
        color: estilosVar.greenBlue
    }
})