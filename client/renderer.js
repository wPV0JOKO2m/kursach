/**
 *
 * handles the connection form UI: validates inputs and initiates the client connection
 */

// --- logger setup (same style as your other modules) ---
const logger = {
  /** log informational messages */
  info: (...args) => console.info('%c[INFO]',  'color:#4CAF50;font-weight:bold;', ...args),
  /** log warning messages */
  warn: (...args) => console.warn('%c[WARN]',  'color:#FFC107;font-weight:bold;', ...args),
  /** log error messages */
  error: (...args) => console.error('%c[ERROR]', 'color:#F44336;font-weight:bold;', ...args),
  /** log debug messages */
  debug: (...args) => console.debug('%c[DEBUG]','color:#9C27B0;font-weight:bold;', ...args),
  /** general-purpose log */
  log: (...args) => console.log('%c[LOG]',   'color:#2196F3;', ...args)
};

// --- Constants ---
const SELECTOR_IDS = {
  FORM:           'connect-form',    // form element ID
  IP_INPUT:       'ip-input',        // input for server IP
  PORT_INPUT:     'port-input',      // input for server port
  NICKNAME_INPUT: 'nickname-input',  // input for user nickname
  ERROR_MSG:      'error-msg'        // span/div for displaying errors
};

const ERROR_MESSAGES = {
  IP:       'invalid ip address',
  PORT:     'port must be 1–65535',
  NICKNAME: 'nickname must be A–Z, a–z or 0–9'
};

// --- DOMContentLoaded Handler ---
window.addEventListener('DOMContentLoaded', () => {
  logger.info('dom fully loaded, wiring up form handlers');

  // cache DOM elements
  const form   = document.getElementById(SELECTOR_IDS.FORM);
  const ipIn   = document.getElementById(SELECTOR_IDS.IP_INPUT);
  const portIn = document.getElementById(SELECTOR_IDS.PORT_INPUT);
  const nickIn = document.getElementById(SELECTOR_IDS.NICKNAME_INPUT);
  const err    = document.getElementById(SELECTOR_IDS.ERROR_MSG);

  // intercept form submission
  form.addEventListener('submit', e => {
    e.preventDefault();
    err.style.display = 'none';

    logger.info('form submit triggered', {
      ip: ipIn.value,
      port: portIn.value,
      nickname: nickIn.value
    });

    // validate IP address field
    if (!ipIn.checkValidity()) {
      logger.warn('validation failed: ip', ipIn.value);
      return showError(ERROR_MESSAGES.IP);
    }

    // validate port number field
    if (!portIn.checkValidity()) {
      logger.warn('validation failed: port', portIn.value);
      return showError(ERROR_MESSAGES.PORT);
    }

    // validate nickname field
    if (!nickIn.checkValidity()) {
      logger.warn('validation failed: nickname', nickIn.value);
      return showError(ERROR_MESSAGES.NICKNAME);
    }

    logger.info('all validations passed, starting client');
    // call exposed API to start the client connection
    window.api.startClient({
      ip:       ipIn.value,
      port:     portIn.value,
      nickname: nickIn.value
    });
  });

  /**
   * display an error message to the user
   * @param {string} msg - the error text to show
   */
  function showError(msg) {
    logger.error('showing error to user:', msg);
    err.textContent = msg;
    err.style.display = 'block';
  }
});
