import { makeRedirectUri, revokeAsync, startAsync } from 'expo-auth-session';
import React, { useEffect, createContext, useContext, useState, ReactNode } from 'react';
import { generateRandom } from 'expo-auth-session/build/PKCE';

import { api } from '../services/api';

interface User {
  id: number;
  display_name: string;
  email: string;
  profile_image_url: string;
}

interface AuthContextData {
  user: User;
  isLoggingOut: boolean;
  isLoggingIn: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

interface AuthProviderData {
  children: ReactNode;
}

const AuthContext = createContext({} as AuthContextData);

const twitchEndpoints = {
  authorization: 'https://id.twitch.tv/oauth2/authorize',
  revocation: 'https://id.twitch.tv/oauth2/revoke'
};

function AuthProvider({ children }: AuthProviderData) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [user, setUser] = useState({} as User);
  const [userToken, setUserToken] = useState('');

  const CLIENT_ID = process.env.CLIENT_ID

  async function signIn() {
    try {
      setIsLoggingIn(true);

      const REDIRECT_URI = makeRedirectUri({
        useProxy: true,
      });
      const RESPONSE_TYPE = "token"
      const SCOPE = encodeURI("openid user:read:email user:read:follows");
      const FORCE_VERIFY = true;
      const STATE = generateRandom(30);

      let authUrl = twitchEndpoints.authorization;
      authUrl = `${authUrl}?client_id=${CLIENT_ID}`;
      authUrl = `${authUrl}&redirect_uri=${REDIRECT_URI}`;
      authUrl = `${authUrl}&response_type=${RESPONSE_TYPE}`;
      authUrl = `${authUrl}&scope=${SCOPE}`;
      authUrl = `${authUrl}&force_verify=${FORCE_VERIFY}`;
      authUrl = `${authUrl}&state=${STATE}`;

      const response = await startAsync({
        authUrl,
      })

      if (response.type === 'success' && response.params?.error !== "acces_denied") {
        if (response.params.state !== STATE) {
          throw Error('Invalid state value');
        }

        const accessToken = response.params?.access_token;

        if (accessToken) {

          api.defaults.headers.Authorization = `Bearer ${accessToken}`;

          const { data: { data: [user] } } = await api.get<{ data: User[] }>('/users');

          setUser({
            id: user.id,
            email: user.email,
            display_name: user.display_name,
            profile_image_url: user.profile_image_url,
          });

          setUserToken(accessToken);
        }
      }
    } catch (error) {
      console.log(new Date(), 'Erro SignIn', error);
      throw error
    } finally {
      setIsLoggingIn(false);
    }
  }

  async function signOut() {
    try {
      setIsLoggingOut(true);

      await revokeAsync({
        token: userToken,
        clientId: CLIENT_ID,
      }, {
        revocationEndpoint: twitchEndpoints.revocation
      })
    } catch (error) {
      console.log(new Date(), 'Erro SignOut', error);
      throw error
    } finally {
      setUser({} as User);
      setUserToken('');
      api.defaults.headers.Authorization = ``;
      setIsLoggingOut(false);
    }
  }

  useEffect(() => {
    api.defaults.headers["Client-Id"] = CLIENT_ID
  }, [])

  return (
    <AuthContext.Provider value={{ user, isLoggingOut, isLoggingIn, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

function useAuth() {
  const context = useContext(AuthContext);

  return context;
}

export { AuthProvider, useAuth };
