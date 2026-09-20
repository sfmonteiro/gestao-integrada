import {setGlobalOptions} from "firebase-functions";
import {onRequest} from "firebase-functions/https";
import * as logger from "firebase-functions/logger";
import express from "express";

setGlobalOptions({maxInstances: 10});

const app = express();

app.get("/callback", (req, res) => {
  const code = req.query.code;
  logger.info("Código recebido da ContaAzul:", code);
  res.send("Callback recebido! Código: " + code);
});

export const api = onRequest(app);
