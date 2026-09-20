import {setGlobalOptions} from "firebase-functions";
import {onRequest} from "firebase-functions/https";
import * as logger from "firebase-functions/logger";
import express from "express";
import axios from "axios";
import * as dotenv from "dotenv";
import * as admin from "firebase-admin";

dotenv.config();
admin.initializeApp();

setGlobalOptions({maxInstances: 10});

const db = admin.firestore();
const app = express();

app.get("/callback", async (req, res) => {
  const code = req.query.code;

  try {
    const response = await axios.post(
      "https://auth.contaazul.com/oauth2/token",
      new URLSearchParams({
        client_id: process.env.CONTAAZUL_CLIENT_ID || "",
        client_secret: process.env.CONTAAZUL_CLIENT_SECRET || "",
        grant_type: "authorization_code",
        code: String(code),
        redirect_uri: process.env.CONTAAZUL_REDIRECT_URI || "",
      })
    );
    const {access_token: accessToken, refresh_token: refreshToken} =
        response.data;

    await db
      .collection("empresas")
      .doc("minha-empresa")
      .collection("integracoes")
      .doc("contaazul")
      .set({
        accessToken,
        refreshToken,
        conectadoEm: new Date().toISOString(),
      });

    res.send("Conectado com sucesso! Token salvo no Firestore.");
  } catch (error) {
    logger.error("Erro ao trocar código por token", error);
    res.status(500).send("Erro ao conectar com a ContaAzul.");
  }
});

export const api = onRequest(app);
