# NOTECOACH 3.2 — Debrief Pós-Jogo

Aplicação local para treinadores registarem o que se lembram de um jogo imediatamente após o apito final.

## Conceito

**Jogo → Debrief → Voz/Texto → Observações → Relatório**

A versão 3.2 remove as ações rápidas e o cronómetro de Match Mode. O foco passa a ser o debrief livre do treinador.

## Funcionalidades
- Criar jogos e selecionar o jogo em análise
- Debrief pós-jogo por áudio
- Pausar, retomar e parar gravações
- Guardar áudio em IndexedDB
- Associar cada gravação ao jogo
- Escrever observações manualmente
- Voz → texto quando suportado pelo browser
- Várias observações/debriefs por jogo
- Categorias: Geral, Ofensivo, Defensivo, Transição Ofensiva, Transição Defensiva, Bolas Paradas e Individual
- Relatório organizado automaticamente a partir das observações do jogo
- PWA / instalação / modo offline
- Sem OpenAI, sem API e sem custos de IA

## Fluxo recomendado
1. Criar o jogo.
2. Depois do jogo, abrir **Debrief**.
3. Carregar em **Gravar debrief**.
4. Falar livremente sem tentar organizar as ideias.
5. Parar e guardar.
6. Acrescentar observações escritas ou outros debriefs.
7. Abrir **Relatórios** e gerar a estrutura do relatório.
