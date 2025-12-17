"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = void 0;
const Platform_1 = require("../platforms/Platform");
const OTHER_CONTROL_CHARACTER = {
    red: '',
    green: '',
    yellow: '',
    blue: '',
    magenta: '',
    reset: '',
}, DEFAULT_CONTROL_CHARACTER = {
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    reset: '\x1b[0m',
};
class Logger {
    static replaceColorTags(message) {
        try {
            message = message.replace(/<magenta>/g, this.outputControlCharacter.magenta);
            message = message.replace(/<\/magenta>/g, this.outputControlCharacter.reset);
            message = message.replace(/<debug>/g, this.outputControlCharacter.magenta);
            message = message.replace(/<\/debug>/g, this.outputControlCharacter.reset);
            message = message.replace(/<blue>/g, this.outputControlCharacter.blue);
            message = message.replace(/<\/blue>/g, this.outputControlCharacter.reset);
            message = message.replace(/<info>/g, this.outputControlCharacter.blue);
            message = message.replace(/<\/info>/g, this.outputControlCharacter.reset);
            message = message.replace(/<green>/g, this.outputControlCharacter.green);
            message = message.replace(/<\/green>/g, this.outputControlCharacter.reset);
            message = message.replace(/<success>/g, this.outputControlCharacter.green);
            message = message.replace(/<\/success>/g, this.outputControlCharacter.reset);
            message = message.replace(/<yellow>/g, this.outputControlCharacter.yellow);
            message = message.replace(/<\/yellow>/g, this.outputControlCharacter.reset);
            message = message.replace(/<warning>/g, this.outputControlCharacter.yellow);
            message = message.replace(/<\/warning>/g, this.outputControlCharacter.reset);
            message = message.replace(/<red>/g, this.outputControlCharacter.red);
            message = message.replace(/<\/red>/g, this.outputControlCharacter.reset);
            message = message.replace(/<error>/g, this.outputControlCharacter.red);
            message = message.replace(/<\/error>/g, this.outputControlCharacter.reset);
        }
        catch { }
        return message;
    }
    static convertMessage(message) {
        return this.replaceColorTags(message);
    }
    static convertMessages(messages) {
        return messages.map((m) => this.replaceColorTags(m));
    }
    static initialization() {
        const RUNTIME = Platform_1.Platform.getShim().runtime, IS_DEFAULT_RUNTIME = RUNTIME === 'default';
        if (IS_DEFAULT_RUNTIME) {
            this.outputControlCharacter = DEFAULT_CONTROL_CHARACTER;
        }
    }
    static debug(...messages) {
        if (this.logDisplay.includes('debug')) {
            console.log(this.convertMessage('<debug>[  DEBUG  ]:</debug>'), ...this.convertMessages(messages));
        }
    }
    static info(...messages) {
        if (this.logDisplay.includes('info')) {
            console.info(this.convertMessage('<info>[  INFO!  ]:</info>'), ...this.convertMessages(messages));
        }
    }
    static success(...messages) {
        if (this.logDisplay.includes('success')) {
            console.log(this.convertMessage('<success>[ SUCCESS ]:</success>'), ...this.convertMessages(messages));
        }
    }
    static warning(...messages) {
        if (this.logDisplay.includes('warning')) {
            console.warn(this.convertMessage('<warning>[ WARNING ]:</warning>'), ...this.convertMessages(messages));
        }
    }
    static error(...messages) {
        if (this.logDisplay.includes('error')) {
            console.error(this.convertMessage('<error>[  ERROR  ]:</error>'), ...this.convertMessages(messages));
        }
    }
}
exports.Logger = Logger;
Logger.logDisplay = ['info', 'success', 'warning', 'error'];
Logger.outputControlCharacter = OTHER_CONTROL_CHARACTER;
//# sourceMappingURL=Log.js.map