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
- Chave OpenAI protegida por variável de ambiente
- Fallback visual quando a API ainda não está configurada

## Instalação
npm install
npm run dev

## Ativar IA
Criar uma variável de ambiente:
OPENAI_API_KEY=...

Opcional:
OPENAI_MODEL=gpt-6-luna

No Vercel, colocar a variável em Project Settings > Environment Variables e fazer novo deploy.

Nunca colocar a chave diretamente em `page.tsx`, `layout.tsx` ou no GitHub.
