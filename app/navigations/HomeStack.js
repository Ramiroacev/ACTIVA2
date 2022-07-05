import React from 'react'
import { createNativeStackNavigator } from "@react-navigation/native-stack"
import Home from '../pantallas/home/Home'
import Logout from '../pantallas/cuenta/Logout'
import Sandbox from '../pantallas/home/Sandbox'
const Stack = createNativeStackNavigator()

export default function HomeStack() {
    return (
        <Stack.Navigator>
            <Stack.Screen
                name="Home"
                component={Home}
                options={{ title: "Home" }}
            />
            <Stack.Screen
                name="Sandbox"
                component={Sandbox}
                options={{ title: "Sandbox" }}
            />
            <Stack.Screen
                name="Logout"
                component={Logout}
                options={{ title: "Logout" }}
            />

        </Stack.Navigator>
    )
}