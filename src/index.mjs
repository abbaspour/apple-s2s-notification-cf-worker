// noinspection JSUnusedGlobalSymbols

import {jwtVerify, createRemoteJWKSet} from 'jose';

const APPLE_ISSUER = 'https://appleid.apple.com';
const APPLE_JWKS_URL = 'https://appleid.apple.com/auth/keys';

// Create a Remote JWK Set to fetch Apple's public keys
const appleJWKS = createRemoteJWKSet(new URL(APPLE_JWKS_URL));

export default {
    async fetch(request, env) {
        try {
            if (request.method !== 'POST') {
                return new Response('Method Not Allowed', {status: 405});
            }

            // Parse the JSON body
            const body = await request.json();

            // The `signedPayload` is expected to contain the JWT from Apple
            const {payload} = body;
            if (!payload) {
                return new Response('Bad Request: Missing payload', {status: 400});
            }

            // Verify the JWT and extract claims
            const {events} = await verifyAndExtractClaims(payload, env.APP_BUNDLE_ID);

            if(!events) {
                return new Response('Bad Request: Payload missing events', {status: 400});
            }

            const connection = env.CONNECTION_NAME || 'apple';

                // Process the event from the claims
            const response = await handleAppleEvent(events, connection);

            return new Response(JSON.stringify(response), {
                headers: {'Content-Type': 'application/json'},
                status: 200,
            });
        } catch (error) {
            console.error('Error handling request:', error);
            return new Response('Internal Server Error', {status: 500});
        }
    },
};

/**
 * Verify the JWT using Apple's public keys and extract claims.
 */
async function verifyAndExtractClaims(token, audience) {
    try {
        // Verify the token using Apple's JWKS
        const {payload} = await jwtVerify(token, appleJWKS, {
            issuer: APPLE_ISSUER,
            audience
        });

        console.log('JWT Verified. Claims:', payload);

        return payload;
    } catch (error) {
        console.error('JWT Verification Failed:', error);
        throw new Error('Unauthorized: Invalid JWT');
    }
}

const userId = (connection, sub) => connection + '|' + sub;

/**
 * Handle the event from Apple's JWT claims.
 */
async function handleAppleEvent(eventString, connection) {
    console.log('Handling Event:', eventString);

    const events = JSON.parse(eventString);

    const user_id = userId(connection, events.sub);

    switch (events.type) {
        case 'account-delete':
            await deleteUser(user_id); // auth0 sub is strategy|upstream_sub
            break;
        case 'consent-revoked':
            await blockUser(user_id);
            break;
        case 'email-disabled':
            break;
        case 'email-enabled':
            await patchUser(user_id, events.email);
            break;

        default:
            console.warn('unsupported event type:', events.type);
    }

    return {status: 'success', type: events?.type};
}

async function deleteUser(user_id) {
    console.log('Deleting Auth0 user:', user_id);
    // Implement your logic to delete the user
}

async function blockUser(user_id) {
    console.log('Block Auth0 user:', user_id);
    // Implement your logic to block the user
}

async function patchUser(user_id, email) {
    console.log(`Patch Auth0 user: ${user_id} to new email: ${email}`);
    // Implement your logic to patch the user
}
