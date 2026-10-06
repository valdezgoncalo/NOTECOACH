import OpenAI from 'openai';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const SYSTEM = `
És um analista de futebol profissional e assistente de treinadores.
Responde em português de Portugal.
Não inventes acontecimentos que não estejam nas notas.
Distingue observações de inferências.
Organiza a resposta com linguagem técnica, objetiva e prática.
Quando fizer sentido, transforma problemas em comportamentos treináveis e propõe exercícios.
`;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { mode, opponent, competition, notes, prompt } = body || {};

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY não está configurada no ambiente.' },
        { status: 503 }
      );
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const model = process.env.OPENAI_MODEL || 'gpt-6-luna';

    const input = `
Tipo de análise: ${mode || 'jogo'}
Adversário: ${opponent || 'não indicado'}
Competição: ${competition || 'não indicada'}

Pedido específico do treinador:
${prompt || 'Faz uma análise técnica completa das notas.'}

NOTAS DO TREINADOR:
${notes || '(sem notas)'}

Produz:
1. Resumo executivo
2. Principais padrões observados
3. Pontos positivos
4. Problemas/prioridades
5. Possíveis causas
6. Comportamentos a treinar
7. Sugestão prática de exercícios
8. 3 prioridades para o próximo treino/jogo
`;

    const response = await client.responses.create({
      model,
      instructions: SYSTEM,
      input
    });

    return NextResponse.json({ result: response.output_text });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Erro interno na análise.' },
      { status: 500 }
    );
  }
}
