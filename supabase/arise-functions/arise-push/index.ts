import webpush from 'npm:web-push@3.6.7';
import {createPushHandler} from '../_shared/push.mjs';
Deno.serve(createPushHandler({requestDetails:webpush.generateRequestDetails.bind(webpush)}));
