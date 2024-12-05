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

            // Process the event from the claims
            const response = await handleAppleEvent(events);

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

/**
 * Handle the event from Apple's JWT claims.
 */
async function handleAppleEvent(events) {
    console.log('Handling Event from Claims:', events);

    switch (events.type) {
        case 'consent-revoked':
        case 'account-delete':
            await deleteUser('apple|' + events.sub); // auth0 sub is strategy|upstream_sub
            break;
        case 'email-disabled':
            break;
        case 'email-enabled':
            break;

        default:
            console.warn('unsupported event type:', events.type);
    }

    return {status: 'success', type: events?.type};
}

async function deleteUser(sub) {
    console.log('Deleting Auth0 user:', sub);
    // Implement your logic to delete the user
}
