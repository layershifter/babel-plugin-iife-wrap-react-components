import { NodePath, PluginObj } from "@babel/core";
import * as t from "@babel/types";
// @ts-ignore No typings :(
import annotateAsPure from "@babel/helper-annotate-as-pure";

type Aa = { types: typeof t };
type A = (a: Aa) => PluginObj;

function createWrappingIIFE(
  id: NodePath<t.Identifier>,
  innerFunction: t.VariableDeclaration | t.FunctionDeclaration,
  statements: NodePath<t.ExpressionStatement>[]
): t.VariableDeclaration {
  const blockStatement = t.blockStatement([
    innerFunction,
    ...statements.map((statement) => t.cloneNode(statement.node)),
    t.returnStatement(t.cloneNode(id.node)),
  ]);

  const callExpression = t.callExpression(
    t.functionExpression(null, [], blockStatement),
    []
  );

  const variableDeclaration = t.variableDeclaration("const", [
    t.variableDeclarator(t.cloneNode(id.node), callExpression),
  ]);

  annotateAsPure(callExpression);

  return variableDeclaration;
}

function findReferencedStatements(
  id: NodePath<t.Identifier>,
  statements: NodePath<t.ExpressionStatement>[]
) {
  return statements.filter(
    (statement) =>
      statement.node &&
      statement.scope.hasOwnBinding(id.node.name) &&
      id.node.name ===
        (((statement.node.expression as t.AssignmentExpression)
          .left as t.MemberExpression).object as t.Identifier).name
  );
}

function isStaticProperty(path: NodePath<t.ExpressionStatement>): boolean {
  if (t.isProgram(path.parentPath)) {
    const expression = path.get("expression");

    if (expression.isAssignmentExpression()) {
      if (t.isMemberExpression(expression.get("left"))) {
        return true;
      }
    }
  }

  return false;
}

const babelPlugin: A = () => {
  return {
    name: "babel-plugin-extract-default-export",

    visitor: {
      Program(programPath) {
        const statements: NodePath<t.ExpressionStatement>[] = [];

        programPath.traverse({
          ExpressionStatement(statementPath) {
            // console.log(programPath.node)
            if (isStaticProperty(statementPath)) {
              statements.push(statementPath);
            }
          },
        });

        if (statements.length === 0) {
          return;
        }
        programPath.traverse({
          ArrowFunctionExpression(arrowFunctionPath) {
            if (arrowFunctionPath.parentPath.isVariableDeclarator()) {
              const id = arrowFunctionPath.parentPath.get("id") as NodePath<
                t.Identifier
              >;

              if (id) {
                const referencedStatements = findReferencedStatements(
                  id,
                  statements
                );

                if (referencedStatements.length > 0) {
                  const wrappingIIFE = createWrappingIIFE(
                    id,
                    t.variableDeclaration("const", [
                      t.variableDeclarator(
                        t.cloneNode(id.node),
                        t.cloneNode(arrowFunctionPath.node)
                      ),
                    ]),
                    referencedStatements
                  );

                  arrowFunctionPath.parentPath.parentPath.replaceWith(
                    wrappingIIFE
                  );

                  referencedStatements.forEach((statement) => {
                    statement.remove();
                  });
                }
              }
            }
          },

          FunctionDeclaration(functionPath) {
            const id = functionPath.get("id");

            if (id.node) {
              const referencedStatements = findReferencedStatements(
                id,
                statements
              );

              if (referencedStatements.length > 0) {
                const wrappingIIFE = createWrappingIIFE(
                  id as NodePath<t.Identifier>,
                  t.cloneNode(functionPath.node),
                  referencedStatements
                );

                functionPath.replaceWith(wrappingIIFE);
                referencedStatements.forEach((statement) => {
                  statement.remove();
                });
              }
            }
          },
        });
      },
    },
  };
};

export default babelPlugin;
