document.addEventListener("DOMContentLoaded", () => {
  const SUPABASE_URL = "https://dsmyejssaorehgwefeqv.supabase.co";
  const SUPABASE_KEY = "sb_publishable_zcZ5izgxZZzjM-YcOhsPqg_c_rsYPni";
  const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  const BUCKET = "product-images";

  const drawer = document.getElementById("drawer");
  const backdrop = document.getElementById("backdrop");
  const btnMenu = document.getElementById("btnMenu");
  const btnCloseDrawer = document.getElementById("btnCloseDrawer");
  const btnRefresh = document.getElementById("btnRefresh");
  const headerSubtitle = document.getElementById("headerSubtitle");
  const toast = document.getElementById("toast");

  const views = {
    dashboard: document.getElementById("view-dashboard"),
    stock: document.getElementById("view-stock"),
    ventes: document.getElementById("view-ventes"),
  };

  // Dashboard
  const kpiRevenue = document.getElementById("kpiRevenue");     // somme prixAchat
  const kpiSalesCount = document.getElementById("kpiSalesCount");
  const kpiProfit = document.getElementById("kpiProfit");       // somme (prixAchat - livraison)
  const dashFilter = document.getElementById("dashFilter");
  const dashSalesBody = document.getElementById("dashSalesBody");

  // Stock
  const stockBody = document.getElementById("stockBody");
  const btnOpenAddProduct = document.getElementById("btnOpenAddProduct");

  // Ventes
  const salesBody = document.getElementById("salesBody");
  const btnOpenAddSale = document.getElementById("btnOpenAddSale");

  // Product modal
  const productModal = document.getElementById("productModal");
  const productModalTitle = document.getElementById("productModalTitle");
  const btnCloseProductModal = document.getElementById("btnCloseProductModal");
  const btnCancelProduct = document.getElementById("btnCancelProduct");
  const productForm = document.getElementById("productForm");
  const productId = document.getElementById("productId");
  const reference = document.getElementById("reference");
  const nom = document.getElementById("nom");
  const prix = document.getElementById("prix");
  const stock = document.getElementById("stock");
  const imageFile = document.getElementById("imageFile");

  // Sale modal
  const saleModal = document.getElementById("saleModal");
  const saleModalTitle = document.getElementById("saleModalTitle");
  const btnCloseSaleModal = document.getElementById("btnCloseSaleModal");
  const btnCancelSale = document.getElementById("btnCancelSale");
  const saleForm = document.getElementById("saleForm");
  const saleId = document.getElementById("saleId");
  const produit_id = document.getElementById("produit_id");
  const prodHint = document.getElementById("prodHint");
  const prixAchat = document.getElementById("prixAchat");
  const fraisLivraison = document.getElementById("fraisLivraison");
  const statut = document.getElementById("statut");
  const nomClient = document.getElementById("nomClient");
  const prenomClient = document.getElementById("prenomClient");
  const telephone = document.getElementById("telephone");
  const adresse = document.getElementById("adresse");

  let produitsCache = [];

  function showToast(message) {
    toast.textContent = message;
    toast.classList.remove("hidden");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toast.classList.add("hidden"), 2400);
  }

  function formatGNF(n) {
    const x = Number(n || 0);
    if (Number.isNaN(x)) return "0 GNF";
    return x.toLocaleString("fr-FR") + " GNF";
  }

  function badgeHtml(st) {
    if (st === "livré") return `<span class="badge ok">livré</span>`;
    return `<span class="badge wait">en attente</span>`;
  }

  function openDrawer() {
    drawer.classList.remove("hidden");
    backdrop.classList.remove("hidden");
  }
  function closeDrawer() {
    drawer.classList.add("hidden");
    backdrop.classList.add("hidden");
  }
  function openModal(modal) { modal.classList.remove("hidden"); }
  function closeModal(modal) { modal.classList.add("hidden"); }

  // ConfirmModal
  const confirmModal = document.getElementById("confirmModal");
  const confirmTitle = document.getElementById("confirmTitle");
  const confirmMessage = document.getElementById("confirmMessage");
  const btnCloseConfirm = document.getElementById("btnCloseConfirm");
  const btnConfirmCancel = document.getElementById("btnConfirmCancel");
  const btnConfirmOk = document.getElementById("btnConfirmOk");

  let _confirmResolve = null;

  function confirmSheet({ title = "Confirmation", message = "Confirmer ?" } = {}) {
    confirmTitle.textContent = title;
    confirmMessage.textContent = message;
    try { navigator.vibrate?.(35); } catch(_) {}
    openModal(confirmModal);
    return new Promise((resolve) => { _confirmResolve = resolve; });
  }
  function closeConfirm(result) {
    closeModal(confirmModal);
    if (_confirmResolve) { _confirmResolve(result); _confirmResolve = null; }
  }
  btnCloseConfirm?.addEventListener("click", () => closeConfirm(false));
  btnConfirmCancel?.addEventListener("click", () => closeConfirm(false));
  btnConfirmOk?.addEventListener("click", () => closeConfirm(true));
  confirmModal?.addEventListener("click", (e) => { if (e.target === confirmModal) closeConfirm(false); });

  function routeTo(route) {
    Object.keys(views).forEach(r => views[r].classList.toggle("hidden", r !== route));
    document.querySelectorAll(".navItem").forEach(b => b.classList.toggle("active", b.dataset.route === route));
    headerSubtitle.textContent = route === "dashboard" ? "Dashboard" : route === "stock" ? "Stock" : "Ventes";
    closeDrawer();

    if (route === "dashboard") loadDashboard();
    if (route === "stock") loadStock();
    if (route === "ventes") loadSales();
  }

  async function uploadImageIfAny(file) {
    if (!file) return "";
    if (!file.type.startsWith("image/")) throw new Error("Fichier non image");

    const ext = file.name.split(".").pop();
    const fileName = `p_${Date.now()}_${Math.random().toString(16).slice(2)}.${ext}`;

    const { error } = await supabase.storage.from(BUCKET).upload(fileName, file, { upsert: false });
    if (error) throw error;

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
    return data.publicUrl;
  }

  // ========================= DASHBOARD =========================
  async function loadDashboard() {
    const filter = dashFilter.value;

    const { data, error } = await supabase
      .from("ventes_details")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      showToast("Erreur dashboard: " + error.message);
      return;
    }

    const rows = (data || []).filter(v => filter === "all" ? true : v.statut === filter);

    // KPI: total prixAchat + total caisse(prixAchat - livraison)
    let totalPrixAchat = 0;
    let totalCaisse = 0;

    rows.forEach(v => {
      const pa = Number(v.prixAchat || 0);
      const liv = Number(v.fraisLivraison || 0);
      totalPrixAchat += pa;
      totalCaisse += (pa - liv);
    });

    kpiRevenue.textContent = formatGNF(totalPrixAchat);
    kpiSalesCount.textContent = String(rows.length);
    kpiProfit.textContent = formatGNF(totalCaisse);

    if (!rows.length) {
      dashSalesBody.innerHTML = `<tr><td colspan="10">Aucune vente.</td></tr>`;
      return;
    }

    dashSalesBody.innerHTML = rows.slice(0, 25).map(v => {
      const caisse = Number(v.prixAchat || 0) - Number(v.fraisLivraison || 0);
      const dateTxt = v.dateAchat ? new Date(v.dateAchat).toLocaleDateString("fr-FR") : "-";

      return `
        <tr>
          <td>${v.nomProduit}</td>
          <td>${v.nomClient} ${v.prenomClient}</td>
          <td>${v.telephone}</td>
          <td>${formatGNF(v.prixUnitaire)}</td>
          <td>${formatGNF(v.prixAchat)}</td>
          <td>${formatGNF(v.fraisLivraison)}</td>
          <td><b>${formatGNF(caisse)}</b></td>
          <td>${badgeHtml(v.statut)}</td>
          <td>${dateTxt}</td>
          <td>
            <button class="btn" data-edit-sale="${v.id}">Modifier</button>
            <button class="btn" data-del-sale="${v.id}" style="border-color:rgba(255,79,109,.55); background:rgba(255,79,109,.12)">Supprimer</button>
          </td>
        </tr>
      `;
    }).join("");

    bindSaleRowActions(dashSalesBody);
  }

  dashFilter.addEventListener("change", loadDashboard);

  // ========================= STOCK =========================
  async function loadStock() {
    const { data, error } = await supabase
      .from("produits")
      .select('id, reference, nom, "prixUnitaire", stock, image')
      .order("id", { ascending: false });

    if (error) { showToast("Erreur stock: " + error.message); return; }

    if (!data || !data.length) {
      stockBody.innerHTML = `<tr><td colspan="6">Aucun produit.</td></tr>`;
      return;
    }

    stockBody.innerHTML = data.map(p => `
      <tr>
        <td>${p.image ? `<img class="miniImg" src="${p.image}" alt="">` : "-"}</td>
        <td>${p.reference}</td>
        <td><b>${p.nom}</b></td>
        <td>${formatGNF(p.prixUnitaire)}</td>
        <td><b>${p.stock}</b></td>
        <td>
          <button class="btn" data-edit-product="${p.id}">Modifier</button>
          <button class="btn" data-del-product="${p.id}" style="border-color:rgba(255,79,109,.55); background:rgba(255,79,109,.12)">Supprimer</button>
        </td>
      </tr>
    `).join("");

    stockBody.querySelectorAll("[data-edit-product]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = Number(btn.dataset.editProduct);
        const { data: p, error: e } = await supabase
          .from("produits")
          .select('id, reference, nom, "prixUnitaire", stock, image')
          .eq("id", id).single();
        if (e) return showToast(e.message);

        productModalTitle.textContent = "Modifier produit";
        productId.value = p.id;
        reference.value = p.reference || "";
        nom.value = p.nom || "";
        prix.value = p.prixUnitaire ?? 0;
        stock.value = p.stock ?? 0;
        imageFile.value = "";
        openModal(productModal);
      });
    });

    stockBody.querySelectorAll("[data-del-product]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = Number(btn.dataset.delProduct);
        const ok = await confirmSheet({
          title: "Supprimer le produit",
          message: "Voulez-vous vraiment supprimer ce produit ? Cette action est définitive."
        });
        if (!ok) return;

        const { error: e } = await supabase.from("produits").delete().eq("id", id);
        if (e) return showToast("Delete KO: " + e.message);

        showToast("Produit supprimé ✅");
        await loadStock();
      });
    });
  }

  btnOpenAddProduct.addEventListener("click", () => {
    productModalTitle.textContent = "Ajouter un produit";
    productId.value = "";
    reference.value = "";
    nom.value = "";
    prix.value = "";
    stock.value = "";
    imageFile.value = "";
    openModal(productModal);
  });

  btnCloseProductModal.addEventListener("click", () => closeModal(productModal));
  btnCancelProduct.addEventListener("click", () => closeModal(productModal));
  productModal.addEventListener("click", (e) => { if (e.target === productModal) closeModal(productModal); });

  productForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      const payload = {
        reference: reference.value.trim(),
        nom: nom.value.trim(),
        prixUnitaire: Number(prix.value),
        stock: Number(stock.value),
      };

      const file = imageFile.files?.[0];
      if (file) payload.image = await uploadImageIfAny(file);

      if (!payload.reference || !payload.nom) return showToast("Référence et nom requis");
      if (Number.isNaN(payload.prixUnitaire) || Number.isNaN(payload.stock)) return showToast("Prix/Stock invalides");

      if (productId.value) {
        const id = Number(productId.value);
        const { error } = await supabase.from("produits").update(payload).eq("id", id);
        if (error) return showToast("Update KO: " + error.message);
        showToast("Produit modifié ✅");
      } else {
        const { error } = await supabase.from("produits").insert([payload]);
        if (error) return showToast("Insert KO: " + error.message);
        showToast("Produit ajouté ✅");
      }

      closeModal(productModal);
      await loadStock();
    } catch (err) {
      console.error(err);
      showToast("Erreur: " + err.message);
    }
  });

  // ========================= VENTES =========================
  async function loadProductsForSalesSelect() {
    const { data, error } = await supabase
      .from("produits")
      .select('id, nom, reference, "prixUnitaire", stock, image')
      .order("id", { ascending: false });

    if (error) { showToast("Erreur produits: " + error.message); return; }

    produitsCache = data || [];
    if (!produitsCache.length) {
      produit_id.innerHTML = `<option value="">Aucun produit</option>`;
      prodHint.textContent = "Ajoute des produits d'abord.";
      return;
    }

    produit_id.innerHTML = produitsCache.map(p => {
      const disabled = p.stock <= 0 ? "disabled" : "";
      return `<option value="${p.id}" ${disabled}>${p.nom} (${p.reference}) — Stock:${p.stock} — ${formatGNF(p.prixUnitaire)}</option>`;
    }).join("");

    updateProdHint();
  }

  function getSelectedProduct() {
    const id = Number(produit_id.value);
    return produitsCache.find(p => p.id === id);
  }

  function updateProdHint() {
    const p = getSelectedProduct();
    if (!p) { prodHint.textContent = ""; return; }
    prodHint.textContent = `Prix stock: ${formatGNF(p.prixUnitaire)} • Stock: ${p.stock}`;
  }
  produit_id.addEventListener("change", updateProdHint);

  async function loadSales() {
    const { data, error } = await supabase
      .from("ventes_details")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) { showToast("Erreur ventes: " + error.message); return; }

    if (!data || !data.length) {
      salesBody.innerHTML = `<tr><td colspan="11">Aucune vente.</td></tr>`;
      return;
    }

    salesBody.innerHTML = data.map(v => {
      const caisse = Number(v.prixAchat || 0) - Number(v.fraisLivraison || 0);
      const dateTxt = v.dateAchat ? new Date(v.dateAchat).toLocaleDateString("fr-FR") : "-";

      return `
        <tr>
          <td>${v.nomProduit}</td>
          <td>${v.nomClient} ${v.prenomClient}</td>
          <td>${v.telephone}</td>
          <td>${formatGNF(v.prixUnitaire)}</td>
          <td>${formatGNF(v.prixAchat)}</td>
          <td>${formatGNF(v.fraisLivraison)}</td>
          <td><b>${formatGNF(caisse)}</b></td>
          <td><b>${formatGNF(v.benefice)}</b></td>
          <td>${badgeHtml(v.statut)}</td>
          <td>${dateTxt}</td>
          <td>
            <button class="btn" data-edit-sale="${v.id}">Modifier</button>
            <button class="btn" data-del-sale="${v.id}" style="border-color:rgba(255,79,109,.55); background:rgba(255,79,109,.12)">Supprimer</button>
          </td>
        </tr>
      `;
    }).join("");

    bindSaleRowActions(salesBody);
  }

  function bindSaleRowActions(containerTbody){
    containerTbody.querySelectorAll("[data-edit-sale]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = Number(btn.dataset.editSale);
        const { data, error } = await supabase
          .from("ventes")
          .select('id, produit_id, "prixAchat", "fraisLivraison", statut, "nomClient", "prenomClient", telephone, adresse')
          .eq("id", id).single();

        if (error) return showToast(error.message);

        saleModalTitle.textContent = "Modifier vente";
        saleId.value = data.id;

        await loadProductsForSalesSelect();
        produit_id.value = String(data.produit_id);
        updateProdHint();

        prixAchat.value = data.prixAchat ?? 0;
        fraisLivraison.value = data.fraisLivraison ?? 0;
        statut.value = data.statut || "en attente";
        nomClient.value = data.nomClient || "";
        prenomClient.value = data.prenomClient || "";
        telephone.value = data.telephone || "";
        adresse.value = data.adresse || "";

        openModal(saleModal);
      });
    });

    containerTbody.querySelectorAll("[data-del-sale]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = Number(btn.dataset.delSale);

        const ok = await confirmSheet({
          title: "Supprimer la vente",
          message: "Voulez-vous vraiment supprimer cette vente ? Le stock sera rétabli (+1)."
        });
        if (!ok) return;

        const { data: v, error: ve } = await supabase
          .from("ventes")
          .select("id, produit_id")
          .eq("id", id).single();
        if (ve) return showToast("Erreur: " + ve.message);

        const { error: de } = await supabase.from("ventes").delete().eq("id", id);
        if (de) return showToast("Delete KO: " + de.message);

        const { data: p, error: pe } = await supabase
          .from("produits")
          .select("id, stock")
          .eq("id", v.produit_id).single();

        if (!pe) {
          await supabase.from("produits").update({ stock: Number(p.stock) + 1 }).eq("id", p.id);
        }

        showToast("Vente supprimée ✅ (stock rétabli)");
        await loadSales();
        await loadDashboard();
        await loadStock();
      });
    });
  }

  btnOpenAddSale.addEventListener("click", async () => {
    saleModalTitle.textContent = "Ajouter une vente";
    saleId.value = "";
    prixAchat.value = "";
    fraisLivraison.value = "0";
    statut.value = "en attente";
    nomClient.value = "";
    prenomClient.value = "";
    telephone.value = "";
    adresse.value = "";

    await loadProductsForSalesSelect();
    openModal(saleModal);
  });

  btnCloseSaleModal.addEventListener("click", () => closeModal(saleModal));
  btnCancelSale.addEventListener("click", () => closeModal(saleModal));
  saleModal.addEventListener("click", (e) => { if (e.target === saleModal) closeModal(saleModal); });

  saleForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const p = getSelectedProduct();
    if (!p) return showToast("Choisis un produit");
    if (p.stock <= 0) return showToast("Stock épuisé");

    const payload = {
      produit_id: p.id,
      prixAchat: Number(prixAchat.value),
      fraisLivraison: Number(fraisLivraison.value),
      nomClient: nomClient.value.trim(),
      prenomClient: prenomClient.value.trim(),
      telephone: telephone.value.trim(),
      adresse: adresse.value.trim(),
      statut: statut.value,
      dateAchat: new Date().toISOString(),
      imageProduit: p.image || ""
    };

    if (Number.isNaN(payload.prixAchat) || Number.isNaN(payload.fraisLivraison)) return showToast("Prix invalides");

    // ✅ TA RÈGLE : benefice = prixAchat - livraison
    payload.benefice = payload.prixAchat - payload.fraisLivraison;

    if (saleId.value) {
      const id = Number(saleId.value);

      const { data: old, error: oe } = await supabase
        .from("ventes")
        .select("id, produit_id")
        .eq("id", id).single();
      if (oe) return showToast(oe.message);

      payload.produit_id = old.produit_id;

      const { error } = await supabase.from("ventes").update(payload).eq("id", id);
      if (error) return showToast("Update KO: " + error.message);

      showToast("Vente modifiée ✅");
    } else {
      const { error } = await supabase.from("ventes").insert([payload]);
      if (error) return showToast("Insert KO: " + error.message);

      const { error: se } = await supabase
        .from("produits")
        .update({ stock: p.stock - 1 })
        .eq("id", p.id);
      if (se) return showToast("Vente OK mais stock KO: " + se.message);

      showToast("Vente ajoutée ✅ (stock -1)");
    }

    closeModal(saleModal);
    await loadSales();
    await loadDashboard();
    await loadStock();
  });

  // Drawer + nav
  btnMenu.addEventListener("click", openDrawer);
  btnCloseDrawer.addEventListener("click", closeDrawer);
  backdrop.addEventListener("click", closeDrawer);

  document.querySelectorAll(".navItem").forEach(btn => {
    btn.addEventListener("click", () => routeTo(btn.dataset.route));
  });

  btnRefresh.addEventListener("click", async () => {
    showToast("Rafraîchissement...");
    const current = document.querySelector(".navItem.active")?.dataset.route || "dashboard";
    if (current === "dashboard") await loadDashboard();
    if (current === "stock") await loadStock();
    if (current === "ventes") await loadSales();
  });

  routeTo("dashboard");
});