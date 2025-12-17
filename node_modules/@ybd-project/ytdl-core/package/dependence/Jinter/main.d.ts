import Visitor from './visitor.js';
export default class Jinter {
    #private;
    /**
     * The node visitor. This is responsible for walking the AST and executing the nodes.
     */
    visitor: Visitor;
    /**
     * The global scope of the program.
     */
    scope: Map<string, any>;
    constructor();
    defineObject<T>(name: string, obj: T): void;
    /**
     * Evaluates the program.
     * @returns The result of the last statement in the program.
     */
    evaluate(input: string): any;
    /**
     * Generates an AST from the input.
     */
    static parseScript(input: string): import("acorn").Program;
}
