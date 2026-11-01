---
title: Set up single sign-on (SSO)
collection: account-and-login
visibility: public
status: current
plan: business
last_updated: 2026-09-15
---

## Availability

SSO is available on the Business and Enterprise plans only. Free and Pro workspaces cannot enable it.

## Set up SAML SSO

1. Sign in as a workspace owner and open **Settings > Security**.
2. Select **Enable SSO** and copy the Orbitly ACS URL and Entity ID.
3. In your identity provider, create a new SAML application and paste those two values.
4. Download the IdP metadata file and upload it in Orbitly.
5. Select **Test connection**, then **Enforce SSO**.

## Common problems

- **"Invalid audience" error:** the Entity ID in your identity provider does not match the one shown in Orbitly. Copy it again.
- **Locked out after enforcing SSO:** a workspace owner can turn enforcement off under **Settings > Security**.
