import * as React from 'react';

const reactAny = React as unknown as {
  __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED?: unknown;
  __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE?: unknown;
};

const secretDescriptor = Object.getOwnPropertyDescriptor(reactAny, '__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED');
const clientInternals = reactAny.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;

if (!secretDescriptor && clientInternals) {
  try {
    Object.defineProperty(reactAny, '__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED', {
      value: clientInternals,
      configurable: true,
      writable: false,
      enumerable: false,
    });
  } catch {
    // Ignore if React prevents defining the property
  }
}
