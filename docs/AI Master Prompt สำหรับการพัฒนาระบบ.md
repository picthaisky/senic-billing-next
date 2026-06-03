# **Master AI Prompt for "Senic Billing Next" Development**

**คำแนะนำการใช้งาน:** ให้ Copy ข้อความตั้งแต่เส้นประด้านล่างนี้ ไปวางใน Claude 4.6 Opus, Gemini 3.1 Pro หรือ ChatGPT (รุ่นสูงสุด) ทีละ Phase หรือวางทั้งหมดเพื่อให้ AI วางโครงสร้างโปรเจกต์ให้ครบจบในรวดเดียว

**System Role & Persona:**

Act as a Principal Software Engineer, Database Architect, and Lead UX/UI Designer. Your task is to architect, design, and develop a modern SaaS billing platform named **"Senic Billing Next"**.

**Project Context & Tech Stack:**

* **Frontend:** React 19, TypeScript, Vite, Tailwind CSS. Must be configured as a Progressive Web App (PWA).  
* **Backend:** C\# .NET 10 Web API using Entity Framework Core 10\. Clean Architecture / CQRS pattern.  
* **Database:** PostgreSQL.  
* **Core Modules:** Receipt, Cash Bill, Delivery Note, Tax Invoice, Dashboard Analytics.  
* **Theming:** Dynamic Theming supporting "Warm Horizon" (Orange-Brown) and "Deep Ocean" (Ocean Blue). Tone: Professional, Futuristic, yet Warm.

Please execute the development of this project in the following highly detailed phases:

### **Phase 1: Database Architecture & Schema Design**

1. Design the complete PostgreSQL database schema for the billing system.  
2. Provide the EF Core 10 Entity classes (Models) in C\#. Include Tenant, Customer, Product, DocumentHeader (Receipt, Invoice, etc.), and DocumentLine.  
3. Ensure exact precision for currency/decimal fields.  
4. Provide the DBContext configuration using Fluent API, explicitly detailing relationships (One-to-Many) and indexes to prevent race conditions during running number generation.

### **Phase 2: Backend API & Business Logic (.NET 10\)**

1. Write the core interface and implementation for the IDocumentNumberGeneratorService to safely generate sequential document numbers (e.g., INV-202605-0001) under high concurrency.  
2. Build a highly secure RESTful API Controller for TaxInvoice.  
3. Implement JWT Authentication and Authorization endpoints.  
4. Output the code utilizing the latest C\# features, asynchronous programming (Task\<T\>), and standard structured JSON responses.

### **Phase 3: Frontend UX/UI & Client Interface (React 19\)**

1. Create a modern UI layout component (DashboardLayout.tsx) utilizing Tailwind CSS that supports the PWA structure (Sidebar, Header, Content Area).  
2. Implement a Custom Hook (useTheme.ts) to toggle CSS variables between "Warm Horizon" (Orange/Brown accents) and "Deep Ocean" (Ocean Blue) dynamically.  
3. Build the InvoiceForm.tsx component. This must be a highly interactive form allowing users to add DocumentLines, dynamically calculating Subtotal, VAT (7%), and Grand Total without re-rendering the whole page (utilizing React 19 concurrent features or simple state management).  
4. The UI must feel "Professional, Futuristic, yet Warm", utilizing rounded corners (rounded-xl), soft glassmorphism, and minimal borders.

### **Phase 4: Premium Asset Generation & Visual Design Prompts**

As the Lead Designer, provide the exact layout specifications and prepare the image generation prompts for our marketing and UI asset team (using Midjourney/DALL-E).

Generate 3 high-quality Image Prompts to create 3D isometric illustrations for the landing page and empty states, strictly adhering to the following art direction:

**Art Direction/Style:**

Highly detailed 3D isometric corporate diorama, premium technical visualization, clean white studio background, realistic industrial and office objects, high-definition render, sharp details, global illumination, soft shadows, subtle ambient occlusion, polished metal, glass, paper documents, floating digital spreadsheet panels, realistic warning icons, professional business presentation style. Balanced composition, cinematic lighting, realistic scale, high clarity, no cartoon style, no low detail, no watermark. The scene should look like a premium management presentation visual, similar to a high-end consulting slide illustration, with realistic objects arranged as a detailed 3D problem-solving diorama.

**Specific Scenes to Generate:**

1. **Prompt 1 (Cloud Database Security):** Apply the Art Direction above. Add context: A glowing secure server rack transitioning into digital document files, emphasizing Cloud Storage for "Senic Billing Next". Color palette: clean white, polished steel, soft grey, **muted Ocean Blue**, with **strong red accents** for firewall/risk indicators.  
2. **Prompt 2 (Billing Workflow):** Apply the Art Direction above. Add context: A modern tablet interface hovering over a neat stack of physical receipts and tax invoices, symbolizing the transition from desktop/paper to digital PWA. Color palette: clean white, polished steel, soft grey, **warm Orange-Brown accents**, with elegant typography elements.  
3. **Prompt 3 (Real-time Analytics):** Apply the Art Direction above. Add context: Floating 3D bar charts and a dashboard UI glowing with positive financial metrics, surrounded by subtle abstract coins. Color palette: clean white, polished glass, soft grey, **brand Orange and Blue**, representing business growth.

*Please begin by outputting the code for Phase 1 and Phase 2\. Once ready, I will ask you to proceed to Phase 3 and 4\.*