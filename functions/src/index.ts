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
app.use(express.json());

// =================      FUNÇÕES      =================

/**
 * Busca o access token salvo, renovando automaticamente
 * via refresh token caso esteja expirado.
 * @return {Promise<string | null>} O token válido, ou null se falhar.
 */
async function obterAccessTokenValido(): Promise<string | null> {
  const doc = await db
    .collection("empresas")
    .doc("minha-empresa")
    .collection("integracoes")
    .doc("contaazul")
    .get();

  const dados = doc.data();

  if (!dados?.refreshToken) {
    return null;
  }

  try {
    const resposta = await axios.post(
      "https://auth.contaazul.com/oauth2/token",
      new URLSearchParams({
        client_id: process.env.CONTAAZUL_CLIENT_ID || "",
        client_secret: process.env.CONTAAZUL_CLIENT_SECRET || "",
        grant_type: "refresh_token",
        refresh_token: dados.refreshToken,
      })
    );

    const {access_token: novoAccessToken, refresh_token: novoRefreshToken} =
            resposta.data;

    await db
      .collection("empresas")
      .doc("minha-empresa")
      .collection("integracoes")
      .doc("contaazul")
      .set({
        accessToken: novoAccessToken,
        refreshToken: novoRefreshToken || dados.refreshToken,
        conectadoEm: dados.conectadoEm,
        renovadoEm: new Date().toISOString(),
      });
    return novoAccessToken;
  } catch (error) {
    logger.error("Erro ao renovar token", axios.isAxiosError(error) ?
      error.response?.data : error);
    return null;
  }
}

// =================      ROTAS      =================

app.get("/callback", async (req, res) => {
  const code = req.query.code;

  try {
    const resposta = await axios.post(
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
        resposta.data;

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
    logger.error("Erro ao trocar código por token",
      axios.isAxiosError(error) ? error.response?.data : error);
    res.status(500).send("Erro ao conectar com a ContaAzul.");
  }
});

app.get("/contas-a-pagar", async (req, res) => {
  try {
    const accessToken = await obterAccessTokenValido();

    if (!accessToken) {
      res.status(400).send("Empresa ainda não conectou a ContaAzul.");
      return;
    }
    const hoje = new Date();
    const em30dias = new Date();
    em30dias.setDate(hoje.getDate() + 30);

    const resposta = await axios.get(
      "https://api-v2.contaazul.com/v1/financeiro/eventos-financeiros" +
        "/contas-a-pagar/buscar",
      {
        // Cabeçalho da autencicação
        headers: {Authorization: `Bearer ${accessToken}`},
        // Parâmetros da consulta
        params: {
          pagina: 1,
          tamanho_pagina: 50,
          data_vencimento_de: hoje.toISOString().split("T")[0],
          data_vencimento_ate: em30dias.toISOString().split("T")[0],
        },
      }
    );

    res.json(resposta.data);
  } catch (error) {
    logger.error("Erro ao buscar contas a pagar",
      axios.isAxiosError(error) ? error.response?.data : error);
    res.status(500).send("Erro ao buscar contas a pagar.");
  }
});

app.get("/contas-financeiras", async (req, res) => {
  try {
    const accessToken = await obterAccessTokenValido();

    if (!accessToken) {
      res.status(400).send("Empresa ainda não conectou a ContaAzul.");
      return;
    }
    const resposta = await axios.get(
      "https://api-v2.contaazul.com/v1/conta-financeira",
      {
        headers: {Authorization: `Bearer ${accessToken}`},
        params: {
          pagina: 1,
          tamanho_pagina: 50,
        },
      }
    );
    res.json(resposta.data);
  } catch (error) {
    logger.error("Erro ao buscar contas financeiras",
      axios.isAxiosError(error) ? error.response?.data : error);
    res.status(500).send("Erro ao buscar contas financeiras.");
  }
});

app.post("/marcar-pago", async (req, res) => {
  try {
    const {parcelaId, contaFinanceiraId, valor} = req.body;

    const accessToken = await obterAccessTokenValido();

    if (!accessToken) {
      res.status(400).send("Empresa ainda não conectou a ContaAzul.");
      return;
    }
    const hoje = new Date().toLocaleDateString("sv-SE", {
      timeZone: "America/Sao_Paulo",
    });

    await axios.post(
      "https://api-v2.contaazul.com/v1/financeiro/eventos-financeiros" +
        `/parcelas/${parcelaId}/baixa`,
      {
        data_pagamento: hoje,
        composicao_valor: {
          valor_bruto: valor,
          multa: 0,
          juros: 0,
          desconto: 0,
          taxa: 0,
        },
        conta_financeira: contaFinanceiraId,
      },
      {
        headers: {Authorization: `Bearer ${accessToken}`},
      }
    );
    res.send("Baixa realizada com sucesso!");
  } catch (error) {
    logger.error("Erro ao dar baixa na parcela",
      axios.isAxiosError(error) ? error.response?.data : error);
    res.status(500).send("Erro ao marcar como pago.");
  }
});

export const api = onRequest(app);
