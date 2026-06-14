# AFINE Obras — Guia de Deploy Completo
## Do código ao ar em ~1 hora, sem servidor próprio

---

## PRÉ-REQUISITOS (gratuito)
- Conta Google (para Firebase)
- Conta GitHub (para Vercel — pode criar agora em github.com)
- Conta Vercel (vercel.com — login com GitHub)
- Node.js instalado no seu computador: nodejs.org (versão 18+)

---

## PASSO 1 — Criar o projeto Firebase

1. Acesse **console.firebase.google.com**
2. Clique em **Adicionar projeto** → dê o nome `afine-obras`
3. Desative o Google Analytics (opcional) → **Criar projeto**
4. No menu lateral, clique em **Build → Firestore Database**
   - Clique **Criar banco de dados**
   - Escolha **Modo de produção** → clique em próximo
   - Selecione a região **us-east1** (mais barato) → **Ativar**
5. No menu lateral, clique em **Build → Storage**
   - Clique **Primeiros passos** → **Modo de produção** → **Avançar** → **Concluído**
6. No menu lateral, clique em **Authentication**
   - **Primeiros passos** → ative **E-mail/senha** → **Salvar**

---

## PASSO 2 — Configurar as credenciais no código

1. No Firebase Console → **Configurações do projeto** (ícone de engrenagem)
2. Role até **Seus aplicativos** → clique em **</>** (Web)
3. Dê o nome `afine-web` → **Registrar aplicativo**
4. Copie o bloco `firebaseConfig`
5. Abra o arquivo `src/firebase.js` e substitua os valores:

```js
const firebaseConfig = {
  apiKey:            "AIzaSy...",      // ← cole o seu
  authDomain:        "afine-obras.firebaseapp.com",
  projectId:         "afine-obras",
  storageBucket:     "afine-obras.appspot.com",
  messagingSenderId: "123456789",
  appId:             "1:123...",
};
```

---

## PASSO 3 — Aplicar as regras de segurança

### Firestore
1. Firebase Console → **Firestore** → aba **Regras**
2. Apague tudo e cole o conteúdo do arquivo `firestore.rules`
3. Clique **Publicar**

### Storage
1. Firebase Console → **Storage** → aba **Regras**
2. Apague tudo e cole o conteúdo do arquivo `storage.rules`
3. Clique **Publicar**

---

## PASSO 4 — Criar os usuários

Para cada pessoa da equipe:

1. Firebase Console → **Authentication** → **Adicionar usuário**
2. Informe e-mail e senha
3. Copie o **UID** gerado (aparece na lista)

Agora crie o perfil de cada usuário no Firestore:

1. **Firestore** → **Iniciar coleção** → nome: `usuarios`
2. ID do documento = **UID do usuário**
3. Adicione os campos:

| Campo   | Tipo   | Valor                        |
|---------|--------|------------------------------|
| nome    | string | Ex: Carlos Eduardo Silva     |
| perfil  | string | `gestor` / `encarregado` / `campo` |
| obras   | array  | IDs das obras que ele acessa |

### Perfis disponíveis:
| Perfil       | Pode fazer                                              |
|--------------|---------------------------------------------------------|
| `gestor`     | Tudo — cria obras, usuários, apaga dados                |
| `encarregado`| Cria/edita escopos, RDO, equipe, materiais, ocorrências |
| `campo`      | Atualiza status de escopos, sobe fotos, OS, cria RDO    |

---

## PASSO 5 — Subir o código no GitHub

No terminal, dentro da pasta `afine-obras`:

```bash
# Instalar dependências
npm install

# Testar localmente (opcional)
npm start

# Criar repositório Git
git init
git add .
git commit -m "AFINE Obras - versão inicial"

# Criar repositório no GitHub (github.com → New repository → afine-obras)
# Depois copie o link e rode:
git remote add origin https://github.com/SEU_USUARIO/afine-obras.git
git push -u origin main
```

---

## PASSO 6 — Deploy no Vercel

1. Acesse **vercel.com** → **Add New Project**
2. Clique **Import** no repositório `afine-obras`
3. Framework: **Create React App** (detectado automaticamente)
4. Clique **Deploy**

Em ~3 minutos o sistema estará no ar em uma URL como:
`https://afine-obras.vercel.app`

### Domínio personalizado (opcional)
No Vercel → **Settings → Domains** → adicione `obras.afine.com.br`

---

## PASSO 7 — Instalar no celular dos funcionários (PWA)

### Android (Chrome):
1. Abra a URL no Chrome
2. Aparece um banner "Adicionar à tela inicial" → toque nele
3. OU: menu (⋮) → **Adicionar à tela inicial**

### iPhone (Safari):
1. Abra a URL no Safari
2. Toque no ícone de compartilhar (□↑)
3. **Adicionar à Tela de Início**

O ícone aparece igual a um app. Abre direto sem abrir o browser.

---

## FLUXO DO FUNCIONÁRIO EM CAMPO

```
1. Abre o app no celular
2. Faz login (e-mail + senha cadastrados pelo gestor)
3. Vê somente as obras que tem acesso
4. Vai em ESCOPOS → toca no serviço que finalizou
5. Seleciona status → CONCLUÍDO
   ↳ Se for MANUTENÇÃO: câmera abre → escaneia a OS assinada
6. Adiciona as 15 fotos (obrigatório) com descrição
7. Salva → painel do gestor atualiza em tempo real (<1 segundo)
```

---

## CUSTOS ESTIMADOS

| Serviço       | Plano gratuito inclui                    | Custo excedente   |
|---------------|------------------------------------------|-------------------|
| Firebase      | 1 GB Firestore, 5 GB Storage, 10k req/dia| ~R$15/GB adicional|
| Vercel        | Deploy ilimitado, HTTPS, CDN global      | Gratuito sempre   |
| **Total**     | **R$ 0/mês** para o volume da AFINE      |                   |

Para referência: 100 obras × 15 fotos × 5 MB = 7.5 GB. Ainda assim < R$150/mês.

---

## SUPORTE

Em caso de dúvidas, abra uma conversa com a IA e cole a mensagem de erro.
Os logs aparecem em **Firebase Console → Functions → Logs** (se usar Functions)
ou no **Vercel Dashboard → Deployments → Logs**.
