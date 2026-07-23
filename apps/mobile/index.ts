// Must be the very first import — supabase-js relies on a full URL implementation
// that Hermes (RN's JS engine) doesn't provide natively.
import 'react-native-url-polyfill/auto';
import { registerRootComponent } from 'expo';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
