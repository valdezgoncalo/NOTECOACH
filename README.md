# NOTECOACH 3.0

Assistente de notas e análise de futebol.

## Novidades
- Tudo da 2.0
- AI Analyst
- Análise de jogo, treino ou individual
- Prompt livre para o treinador
- Análise baseada nas notas recolhidas
- Estrutura automática: resumo, padrões, pontos fortes, problemas, causas, comportamentos treináveis, exercícios e prioridades
- Endpoint server-side `/api/analyze`
- Fallback visual quando a API ainda não está configurada

## Instalação
npm install
npm run dev

## Ativar IA
Criar uma variável de ambiente:

Opcional:

No Vercel, colocar a variável em Project Settings > Environment Variables e fazer novo deploy.

Nunca colocar a chave diretamente em `page.tsx`, `layout.tsx` ou no GitHub.


## NOTECOACH 3.1 — Áudio + PWA
- Gravação com pausa/retoma/paragem e associação automática à nota.
- Melhor tratamento das permissões do microfone em HTTPS.
- PWA instalável em Android, tablet e Windows compatíveis.
- Service Worker para cache/offline.
- Sem IA e sem API externa.
