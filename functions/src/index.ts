/**
* Import function triggers from their respective submodules:
*
* import {onCall} from "firebase-functions/v2/https";
* import {onDocumentWritten} from "firebase-functions/v2/firestore";
*
* See a full list of supported triggers at https://firebase.google.com/docs/functions
*/

import { setGlobalOptions } from 'firebase-functions';
import { onRequest } from 'firebase-functions/https';
import { onCall } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import * as auth from './auth/index';

// Start writing functions
// https://firebase.google.com/docs/functions/typescript

// For cost control, you can set the maximum number of containers that can be
// running at the same time. This helps mitigate the impact of unexpected
// traffic spikes by instead downgrading performance. This limit is a
// per-function limit. You can override the limit for each function using the
// `maxInstances` option in the function's options, e.g.
// `onRequest({ maxInstances: 5 }, (req, res) => { ... })`.
// NOTE: setGlobalOptions does not apply to functions using the v1 API. V1
// functions should each use functions.runWith({ maxInstances: 10 }) instead.
// In the v1 API, each function can only serve one request per container, so
// this will be the maximum concurrent request count.
setGlobalOptions({ maxInstances: 10 });

// export const helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });

export const helloWorld = onRequest((request: any, response: any) => {
  logger.info('helloWorld called');
  response.status(200).send('Hello from Firebase (helloWorld)');
});

export const callableHello = onCall((req) => {
  logger.info('callableHello called', { data: req.data });
  return { message: 'Hello from callable', echo: req.data };
});

// Re-export auth functions
export const checkRegisteredPhone = auth.checkRegisteredPhone;
export const sendOtp = auth.sendOtp;
export const verifyOtpAndLogin = auth.verifyOtpAndLogin;
export const logout = auth.logout;
