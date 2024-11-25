import {
    APIGatewayAuthorizerResult,
    APIGatewayAuthorizerResultContext,
    APIGatewayTokenAuthorizerEvent,
    StatementEffect,
  } from "aws-lambda";
  
  const USERNAME = process.env.USERNAME || "";
  const PASSWORD = process.env.PASSWORD || "";
  
  export async function handler(
    event: APIGatewayTokenAuthorizerEvent
  ): Promise<APIGatewayAuthorizerResult> {
    try {
      console.log("[basicAuthorizer] event:", JSON.stringify(event));
      const authHeader = event?.authorizationToken;
      const resourceArn = event?.methodArn;
  
      if (!authHeader) {
        console.error("Unauthorized: Authorization header is missing");
        const error = new Error("Authorization header is missing");
        error.name = "UnauthorizedError";
        throw error;
      }
  
      const [type, token] = authHeader.split(" ");
      if (type !== "Basic" || !token) {
        console.error(`Invalid token: type ${type}, token ${token}`);
        return generatePolicy("user", "Deny", resourceArn, {
          error: "Invalid token",
          statusCode: 401,
        });
      }
  
      const credentials = atob(token);
      const [username, password] = credentials.split(":");
  
      if (username === USERNAME && password === PASSWORD) {
        console.log("Authorized");
        return generatePolicy("user", "Allow", resourceArn, { username });
      } else {
        console.log("Invalid credentials");
        return generatePolicy("user", "Deny", resourceArn, {
          error: "Invalid credentials",
          statusCode: 403,
        });
      }
    } catch (e) {
      console.log("[basicAuthorizer] error:", JSON.stringify(e));
      return generatePolicy("unauthorized", "Deny", event.methodArn, {
        error: "Internal Server Error",
        statusCode: 500,
      });
      throw e;
    }
  }
  
  function generatePolicy(
    principalId: string,
    effect: StatementEffect,
    resource: string,
    context?: APIGatewayAuthorizerResultContext
  ): APIGatewayAuthorizerResult {
    return {
      principalId,
      policyDocument: {
        Version: "2012-10-17",
        Statement: [
          {
            Action: "execute-api:Invoke",
            Effect: effect,
            Resource: resource,
          },
        ],
      },
      context,
    };
  }
