document.addEventListener("DOMContentLoaded", () => {

  const SUPABASE_URL = "https://dsmyejssaorehgwefeqv.supabase.co";
  const SUPABASE_KEY = "sb_publishable_zcZ5izgxZZzjM-YcOhsPqg_c_rsYPni";
  const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  const kpiRevenue = document.getElementById("kpiRevenue");
  const kpiSalesCount = document.getElementById("kpiSalesCount");
  const kpiProfit = document.getElementById("kpiProfit");
  const dashSalesBody = document.getElementById("dashSalesBody");
  const salesBody = document.getElementById("salesBody");

  function formatGNF(n) {
    return Number(n || 0).toLocaleString("fr-FR") + " GNF";
  }

  function badgeHtml(statut) {
    return statut === "livré"
      ? `<span class="badge ok">livré</span>`
      : `<span class="badge wait">en attente</span>`;
  }

  async function loadDashboard() {
    const { data, error } = await supabase
      .from("ventes_details")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    let totalPrixAchat = 0;
    let totalCaisse = 0;

    data.forEach(v => {
      const pa = Number(v.prixAchat || 0);
      const liv = Number(v.fraisLivraison || 0);
      totalPrixAchat += pa;
      totalCaisse += (pa - liv);
    });

    kpiRevenue.textContent = formatGNF(totalPrixAchat);
    kpiSalesCount.textContent = data.length;
    kpiProfit.textContent = formatGNF(totalCaisse);

    dashSalesBody.innerHTML = data.map(v => {
      const caisse = Number(v.prixAchat || 0) - Number(v.fraisLivraison || 0);
      const dateTxt = v.dateAchat
        ? new Date(v.dateAchat).toLocaleDateString("fr-FR")
        : "-";

      return `
        <tr>
          <td>${v.nomProduit}</td>
          <td>${v.nomClient} ${v.prenomClient}</td>
          <td>${v.telephone}</td>
          <td>${v.adresse || "-"}</td>
          <td>${formatGNF(v.prixUnitaire)}</td>
          <td>${formatGNF(v.prixAchat)}</td>
          <td>${formatGNF(v.fraisLivraison)}</td>
          <td><b>${formatGNF(caisse)}</b></td>
          <td>${badgeHtml(v.statut)}</td>
          <td>${dateTxt}</td>
        </tr>
      `;
    }).join("");
  }

  async function loadSales() {
    const { data, error } = await supabase
      .from("ventes_details")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    salesBody.innerHTML = data.map(v => {
      const caisse = Number(v.prixAchat || 0) - Number(v.fraisLivraison || 0);
      const dateTxt = v.dateAchat
        ? new Date(v.dateAchat).toLocaleDateString("fr-FR")
        : "-";

      return `
        <tr>
          <td>${v.nomProduit}</td>
          <td>${v.nomClient} ${v.prenomClient}</td>
          <td>${v.telephone}</td>
          <td>${v.adresse || "-"}</td>
          <td>${formatGNF(v.prixUnitaire)}</td>
          <td>${formatGNF(v.prixAchat)}</td>
          <td>${formatGNF(v.fraisLivraison)}</td>
          <td><b>${formatGNF(caisse)}</b></td>
          <td><b>${formatGNF(v.benefice)}</b></td>
          <td>${badgeHtml(v.statut)}</td>
          <td>${dateTxt}</td>
        </tr>
      `;
    }).join("");
  }

  loadDashboard();
  loadSales();

});