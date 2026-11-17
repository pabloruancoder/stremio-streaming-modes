# Streaming Modes para Stremio

Escolha um streaming (Netflix, Disney+, Apple TV ou Prime Video) e o Stremio muda de cara: transição animada,
visual inspirado no serviço, banner de destaque e só as fileiras daquele streaming.
Um clique volta para o Stremio padrão.

O projeto tem duas partes:

| Parte | O que faz | Onde funciona |
|---|---|---|
| `addon/` | Fileiras de cada streaming: Top 10 oficial do país, "Só na Netflix", em alta, lançamentos, aclamados e gêneros (só títulos disponíveis no streaming no Brasil). Na Disney+, também as marcas: Disney, Pixar, Marvel, Star Wars, National Geographic e Star | Em qualquer Stremio (PC, celular, TV) |
| `plugin/` | Seletor de modo, transição, tema, banner de destaque e filtro das fileiras | Stremio Enhanced (desktop) |

## 1. Rodar o addon

Requer Node 22.9 ou mais recente.

```bash
cd addon
copy .env.example .env      # depois coloque sua chave do TMDB no .env
npm start
```

- **Chave do TMDB:** é grátis em https://www.themoviedb.org/settings/api. Sem ela, só o Top 10
  aparece, e títulos com nome ambíguo podem vir errados.
- No Stremio, vá em **Addons**, cole `http://127.0.0.1:7100/manifest.json` na busca e instale.
- O addon precisa estar rodando para as fileiras carregarem.

## 2. Instalar o plugin

1. Instale o **Stremio Enhanced**: `winget install REVENGE.StremioEnhanced`. Para assistir, ele
   também precisa do Stremio Service: `winget install Stremio.StremioService`.
2. Copie o plugin: `node scripts/install-plugin.mjs`. Ele vai para
   `%APPDATA%\stremio-enhanced\plugins`.
3. Ative o plugin. A tela **Settings > Plugins** do Stremio Enhanced 1.2.0 não aparece no Stremio
   atual, então ative pelo console: abra com **Ctrl+Shift+I**, vá na aba **Console** e rode
   ```js
   localStorage.setItem('enabledPlugins', JSON.stringify(['streaming-modes.plugin.js'])); location.reload()
   ```

## Como usar

- Use o botão **Modo** na barra superior, ou **Alt+M**, e escolha **Netflix** ou **Stremio padrão**.
  A escolha fica salva entre sessões.
- Ao entrar no modo Netflix, toca uma vinheta, em tela cheia e sem controles. O plugin procura nesta ordem:
  1. `addon/intro/netflix.mp4` (ou `.webm`) no PC, servido pelo addon local (essa pasta não vai para o GitHub);
  2. `addon/intro-publica/netflix.mp4` (ou `.webm`) do repositório, publicada no GitHub Pages em `/intro/netflix.mp4`.
     Use aqui só um vídeo próprio, que você tenha o direito de publicar;
  3. sem nenhum dos dois, a vinheta oficial pelo player do YouTube.
  Para tocar sem som, rode no console `localStorage.setItem('streamingModes.introSound', 'false')`.
- No modo Netflix, a Home é desenhada pelo plugin:
  - barra com Início, Séries, Filmes, Novidades e populares e Minha lista;
  - banner com trailer;
  - Top 10 com números;
  - capas que se expandem ao passar o mouse, com selo ("Nº 2 em séries esta semana", "Novidade"), sinopse e botões;
  - fileira "Porque você se interessou por…" que aparece na hora, com títulos parecidos com o último que você abriu;
  - janela **Mais informações** com episódios e títulos semelhantes. Se você já começou, o botão vira
    "Continuar T1:E5", com barra de progresso, e o episódio atual fica destacado;
  - **Explorar tudo** abre uma tela com todos os títulos da fileira, carregando mais ao descer;
  - a Home continua com fileiras pelos seus gostos e termina com **Voltar ao início**;
  - **Novidades e populares**: fileiras com as novidades, o Top 10 e as estreias (Chegando esta semana, na próxima
    semana e Vale a espera). O sininho de cada estreia ativa **Lembrar-me**, que avisa quando o título chegar;
  - sininho com as novidades (Top 10 da semana e o que acabou de chegar) e menu de perfil com atalhos do Stremio;
  - busca no layout da TV: categorias à esquerda viram sugestões enquanto você digita, e as capas aparecem ao lado.
    Só títulos da Netflix Brasil, por nome, ator ou diretor e gênero ("terror", "filmes de comédia"). Sem nada digitado,
    mostra recomendações sem fim a partir do que você assiste (ex.: "Para quem curte documentários de crime").
- **Assistir** abre a lista de fontes do Stremio, e **Voltar** retorna para a Home Netflix.
- **Continuar assistindo**, **Minha lista** e **Porque você assistiu…** vêm do seu histórico no Stremio.
- No menu do modo, você pode mostrar as fileiras dos streamings também no modo padrão e mudar o
  endereço do addon (por exemplo, se ele estiver hospedado online).

## Perfis, avaliações e prévias

- **Quem está assistindo?** aparece uma vez por sessão no modo Netflix. Até 5 perfis, com avatar; troque pelo menu do
  avatar ou em **Gerenciar perfis**.
  - O perfil principal usa a biblioteca do Stremio. Os outros têm Minha lista e histórico próprios; o Continuar
    assistindo e as recomendações de cada perfil usam só o que ele assistiu.
  - **Perfil infantil:** só fileiras infantis (filmes Livre e 10 anos, séries infantis), sem Top 10 nem Novidades,
    e busca e recomendações filtradas.
- **Avaliação (👎 / 👍 / 👍👍):** nas capas expandidas, na prévia e na janela de detalhes. "Não é pra mim" tira o título
  das recomendações; "Gostei" e "Amei!" geram fileiras como "Porque você amou…". Cada perfil tem as suas.
- **Prévia com trailer:** a capa expandida toca o trailer com som (botão de som na própria capa, a escolha fica salva).

## Player no estilo Netflix

No modo Netflix, o player do Stremio ganha:

- barra de progresso vermelha e controles no visual da Netflix;
- **Pular abertura**: em animes, com os tempos da base pública AniSkip. Em outras séries, o plugin aprende: se você
  pular a abertura na mão num episódio, o botão aparece nos próximos episódios da série;
- **Próximo episódio** no fim (no encerramento do anime ou nos últimos 30 segundos), com contagem regressiva de 10 s.
  **Assistir aos créditos** cancela;
- **Continuar assistindo** mostra o episódio (T1:E5) e troca o episódio terminado pelo próximo.

## Fileiras no celular e na TV (addon online)

- **GitHub Pages (grátis, sem servidor):** o workflow `.github/workflows/addon-pages.yml` gera as fileiras como arquivos
  e publica no GitHub Pages a cada 3 horas. Cada fileira traz **todos** os títulos (o catálogo inteiro da Netflix BR,
  ~8 mil filmes e séries, em arquivos de 100 que o Stremio carrega conforme você rola), e as fileiras
  **Adicionados recentemente** mostram o que entrou na Netflix desde as execuções anteriores (inclusive filmes antigos
  que acabaram de chegar). O histórico fica em `state/netflix.json` no próprio Pages. Precisa do segredo `TMDB_READ_TOKEN` (ou `TMDB_API_KEY`) no repositório e do
  Pages ativado com a fonte **GitHub Actions**. Instale `https://USUARIO.github.io/REPOSITORIO/manifest.json` no
  celular e na TV. Para gerar localmente: `node --env-file-if-exists=.env scripts/build-static.mjs` (na pasta `addon`).
  Busca, trailers, perfis e o player continuam usando o addon local no PC.

Hospedado online, o addon funciona em qualquer Stremio (celular, TV, outro PC). O visual Netflix continua só no PC.

- **Render (grátis):** suba o projeto para um repositório no GitHub, crie uma conta no Render e use
  **New > Blueprint** apontando para o repositório. O `render.yaml` já configura tudo; informe a chave do TMDB quando pedir.
  No plano grátis o serviço "dorme" após 15 min sem uso e leva ~1 min para acordar.
- **Docker (Koyeb, Fly.io, Railway, VPS):** use o `addon/Dockerfile` e defina `TMDB_API_KEY` ou `TMDB_READ_TOKEN`.

Depois, instale `https://SEU-ENDERECO/manifest.json` no Stremio de cada aparelho. No PC, troque o endereço do addon no
menu **Modo** do plugin.

## Adicionar outro streaming

1. Em `addon/src/providers.js`, adicione o serviço com o ID de provedor do TMDB. A lista de IDs
   está no próprio arquivo.
2. Em `plugin/streaming-modes.plugin.js`, adicione uma entrada em `MODES` (cor e prefixo
   `"Nome • "`) e um bloco de CSS em `THEMES`.

O Top 10 oficial só existe para a Netflix. Na Disney+ o destaque e as fileiras usam o que está em alta, e a Home
tem os blocos de marca (cada um abre uma página com os filmes e as séries da marca).

No GitHub Pages, o manifest da raiz é o da Netflix (o endereço já instalado). Cada streaming também tem o seu:
`https://USUARIO.github.io/REPOSITORIO/disney/manifest.json` para a Disney+, `/apple/manifest.json` para a Apple TV, `/prime/manifest.json` para o Prime Video (e `/netflix/manifest.json`).

Na Apple TV (o antigo Apple TV+), o visual segue o app do tvOS 26: menu lateral de vidro, destaque em tela cheia, pôsteres na vertical
que inclinam com o mouse e detalhes em página inteira.

## Limitações

- O visual só muda no Stremio Enhanced e no navegador. Os apps oficiais de TV e celular não
  aceitam temas, mas mostram as fileiras do addon normalmente.
- O plugin se apoia na estrutura do Stremio Web (`data-board-row` e nomes de classe). Uma
  atualização grande do Stremio pode exigir ajustes.
- O tema é inspirado no visual da Netflix e não usa logos nem imagens da marca. Feito para uso pessoal.
