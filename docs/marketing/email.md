# E-mails — 4 de boas-vindas + 1 de lançamento

Remetente: [preencher nome] <[preencher]@mostra.page>, com SPF, DKIM e DMARC configurados antes do primeiro envio. Texto simples com uma imagem no máximo; um único CTA por e-mail; link de descadastro em todos os automáticos que não sejam transacionais. Variáveis entre chaves vêm do backend: `{nome}`, `{creditos}`, `{projetos}`, `{link}`.

Sequência de boas-vindas disparada por evento, não por dia fixo: se a pessoa já fez a ação, o e-mail correspondente é pulado. Números de `lib/planos.ts`.

---

## Boas-vindas 1 · No cadastro (imediato)

**Assunto:** Seus 50 créditos estão prontos, {nome}
**Pré-cabeçalho:** Uma apresentação de 10 telas custa 10. Comece por aí.

Oi, {nome}.

Sua conta no Mostra está aberta, com {creditos} créditos e {projetos} projetos no plano Free. Sem cartão, sem prazo.

A conta é simples: a IA escreve o roteiro de graça e cobra 1 crédito por tela que desenha. Uma apresentação de 10 telas custa 10 créditos; com os seus {creditos} dá para fazer cinco dessas.

O jeito mais rápido de ver o Mostra funcionando:

1. Abra "Criar com IA".
2. Cole um briefing real (uma proposta, um resumo de projeto, um texto que você já tenha).
3. Escolha a marca e peça 10 telas.

Em dois minutos você tem o roteiro; em mais alguns, as telas.

**[Criar minha primeira apresentação →]** {link}

Qualquer dúvida, responda este e-mail. Quem lê é gente do time.

[preencher assinatura]

---

## Boas-vindas 2 · Não gerou nada em 24 h

**Assunto:** O que você apresenta hoje, {nome}?
**Pré-cabeçalho:** Três briefings prontos para testar, se faltou ideia.

Oi, {nome}.

Vi que você criou a conta e ainda não gerou uma apresentação. Normal: a parte difícil é decidir por onde começar.

Três sugestões de briefing, para copiar e colar:

- **Proposta comercial:** "Proposta de [serviço] para [cliente]: contexto, diagnóstico, escopo em 3 fases, cronograma de 8 semanas, investimento e próximos passos. Tom direto. 12 telas."
- **Pitch:** "Pitch de [empresa] para investidores: problema, solução, produto, mercado, modelo de negócio, tração, time e pedido. 10 telas."
- **Resultados:** "Apresentação de resultados do trimestre de [área]: números principais, 3 destaques, 2 aprendizados, plano do próximo trimestre. 8 telas."

O roteiro sai grátis. Se não gostar, peça outro; só o desenho das telas consome créditos.

**[Testar com um desses briefings →]** {link}

[preencher assinatura]

---

## Boas-vindas 3 · Gerou, mas não publicou link (48 h depois de gerar)

**Assunto:** Falta um passo: o link
**Pré-cabeçalho:** Senha, validade e aviso de quando o cliente abrir.

Oi, {nome}.

Sua apresentação "{titulo}" está pronta no editor. Falta a parte em que o Mostra deixa de ser um editor e vira um jeito de entregar.

Clique em "Compartilhar" e você ganha um link privado. Dá para:

- Exigir senha (a partir do Pro) e definir uma validade.
- Ver quantas vezes o link foi aberto.
- Atualizar o projeto depois de enviado: o cliente vê a nova versão no mesmo link, sem reenvio.
- Revogar quando quiser.

Quem recebe não precisa de conta: abre no navegador, no computador ou no celular.

Se você precisa de um arquivo, exporte em PDF direto do editor (uma página por tela, fontes embutidas).

**[Abrir "{titulo}" e compartilhar →]** {link}

[preencher assinatura]

---

## Boas-vindas 4 · Usou mais de 70% dos créditos

**Assunto:** Você usou {creditos_usados} dos seus 50 créditos
**Pré-cabeçalho:** Dois jeitos de continuar, em reais.

Oi, {nome}.

Você já desenhou {creditos_usados} telas com IA. Quando os créditos do Free acabarem, nada é apagado: editar, apresentar e compartilhar continuam grátis. O que para é a IA desenhar telas novas.

Dois jeitos de continuar:

**Pacote avulso, sem assinatura.** 100 créditos por R$ 19, 400 por R$ 69 ou 2.000 por R$ 299. Não expiram e valem no Free.

**Plano mensal, se isso virou rotina.**
- Plus, R$ 29/mês: 150 créditos por mês, projetos ilimitados, apresentações de até 20 telas, sem marca d'água.
- Pro, R$ 74/mês: 400 créditos, até 30 telas, links com senha e métricas, 10 domínios próprios.
- Studio, R$ 149 por membro/mês: 800 créditos por membro, compartilhados pela equipe, edição em tempo real.

No anual, 20% de desconto. O que sobrar do mês acumula até 2× a cota.

**[Ver planos e pacotes →]** https://mostra.page/precos

Se preferir ficar no Free, tudo bem: seus projetos continuam seus.

[preencher assinatura]

---

## Lançamento · Para toda a base (Dia D, 09h00)

**Assunto:** O Mostra abriu para todo mundo
**Pré-cabeçalho:** Do briefing ao link, com IA e um editor de verdade. Grátis para começar.

Oi, {nome}.

Hoje o Mostra sai do acesso antecipado. Obrigado por ter entrado antes: cada bug que você achou e cada "isso aqui não faz sentido" virou uma correção. [preencher: duas melhorias concretas que vieram do acesso antecipado.]

O que o Mostra faz, para quem chegou agora:

1. **Descreva o briefing** (ou cole um texto ou PDF). A IA escreve o roteiro, tela por tela. Grátis.
2. **Mande desenhar.** Cada tela sai no seu kit de marca, editável. 1 crédito por tela.
3. **Ajuste num editor de canvas livre:** camadas, grupos, guias, auto layout. Cole do Figma e do Illustrator. Transições, Lottie, 3D.
4. **Envie por link privado:** senha, validade, visualizações. Atualizou? O cliente vê a nova versão.

Três formatos no mesmo projeto: Slides, Story e Explorar.

Planos em reais: Free com 50 créditos e 3 projetos, Plus R$ 29, Pro R$ 74, Studio R$ 149 por membro. Pacotes avulsos que não expiram.

Hoje estamos no Product Hunt. Se o Mostra te ajudou, contar isso lá com as suas palavras vale mais que qualquer voto: [preencher link do PH].

**[Criar uma apresentação agora →]** https://mostra.page

[preencher assinatura]

Você recebe este e-mail porque criou uma conta no Mostra. [Descadastrar das novidades] (os e-mails da conta continuam.)
