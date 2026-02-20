-- Catálogo de Vehículos McQueen Concesionario
-- Actualizado: 2026-02-02

-- Limpiar datos existentes
DELETE FROM dealership_catalog;

-- ============================================
-- CATEGORÍA: SUV
-- ============================================

INSERT INTO dealership_catalog (make, model, year, category, price, speed, stock, image_url)
VALUES
('Chevlon', 'Camión 2018', 2018, 'SUV', 70000, 131, 5, 'https://static.wikia.nocookie.net/emergency-response-liberty-county/images/f/fe/Chevlon_Camion_2018.png'),
('Falcon', 'Carroñero 2016', 2016, 'SUV', 60000, 126, 5, 'https://static.wikia.nocookie.net/emergency-response-liberty-county/images/4/4a/Falcon_Scavenger_2016.png'),
('Navara', 'Boundary 2022', 2022, 'SUV', 80000, 140, 5, 'https://static.wikia.nocookie.net/emergency-response-liberty-county/images/0/05/Navara_Boundary_2022.png'),
('Chevlon', 'Camion 2021', 2021, 'SUV', 110000, 128, 5, 'https://static.wikia.nocookie.net/emergency-response-liberty-county/images/4/44/Chevlon_Camion_2021.png'),
('Chevlon', 'Platoro 2019', 2019, 'SUV', 120000, 131, 5, 'https://static.wikia.nocookie.net/emergency-response-liberty-county/images/9/90/Chevlon_Platoro_2019.png'),
('Vellfire', 'Prairie 2022', 2022, 'SUV', 100000, 131, 5, 'https://static.wikia.nocookie.net/emergency-response-liberty-county/images/4/4c/Vellfire_Prairie_2022.png'),
('Averon', 'Anodic 2024', 2024, 'SUV', 80000, 119, 5, 'https://static.wikia.nocookie.net/emergency-response-liberty-county/images/5/59/Averon_Anodic_2024.png'),
('Overland', 'Apache SFP 2020', 2020, 'SUV', 130000, 147, 5, 'https://static.wikia.nocookie.net/emergency-response-liberty-county/images/0/03/Overland_Apache_SFP_2020.png'),
('Leland', 'Vault 2020', 2020, 'SUV', 200000, 125, 3, 'https://static.wikia.nocookie.net/emergency-response-liberty-county/images/7/7f/Leland_Vault_2020.png'),
('Falcon', 'Rampage Beast 2021', 2021, 'SUV', 210000, 99, 3, 'https://static.wikia.nocookie.net/emergency-response-liberty-county/images/0/0f/Falcon_Rampage_Beast_2021.png'),
('Averon', 'Q8 2022', 2022, 'SUV', 340000, 125, 2, 'https://static.wikia.nocookie.net/emergency-response-liberty-county/images/d/de/Averon_Q8_2022.png');

-- ============================================
-- CATEGORÍA: SEDAN
-- ============================================

INSERT INTO dealership_catalog (make, model, year, category, price, speed, stock, image_url)
VALUES
('Celestial', 'Type-6 2023', 2023, 'Sedan', 70000, 145, 5, 'https://static.wikia.nocookie.net/emergency-response-liberty-county/images/9/96/Celestial_Type-6_2023.png'),
('Bullhorn', 'Prancer 2015', 2015, 'Sedan', 90000, 133, 5, 'https://static.wikia.nocookie.net/emergency-response-liberty-county/images/5/50/Bullhorn_Prancer_2015.png'),
('Bullhorn', 'Prancer Widebody 2020', 2020, 'Sedan', 250000, 136, 3, 'https://static.wikia.nocookie.net/emergency-response-liberty-county/images/0/06/Bullhorn_Prancer_Widebody_2020.png'),
('Averon', 'S5 2010', 2010, 'Sedan', 190000, 117, 3, 'https://static.wikia.nocookie.net/emergency-response-liberty-county/images/7/7b/Averon_S5_2010.png');

-- ============================================
-- CATEGORÍA: LUJO
-- ============================================

INSERT INTO dealership_catalog (make, model, year, category, price, speed, stock, image_url)
VALUES
('Falcon', 'eStallion 2024', 2024, 'Lujo', 100000, 124, 5, 'https://static.wikia.nocookie.net/emergency-response-liberty-county/images/e/e2/Falcon_eStallion_2024.png'),
('Chevlon', 'Amigo Sport 2016', 2016, 'Lujo', 150000, 121, 4, 'https://static.wikia.nocookie.net/emergency-response-liberty-county/images/8/85/Chevlon_Amigo_Sport_2016.png'),
('Chevlon', 'Amigo LZR 2011', 2011, 'Lujo', 140000, 133, 4, 'https://static.wikia.nocookie.net/emergency-response-liberty-county/images/f/f4/Chevlon_Amigo_LZR_2011_main.png'),
('Bullhorn', 'Determinator SFP Blackjack Widebody 2022', 2022, 'Lujo', 270000, 162, 2, 'https://static.wikia.nocookie.net/emergency-response-liberty-county/images/3/30/Bullhorn_Determinator_SFP_Blackjack_Widebody_2022.png'),
('Falcon', 'Stallion 350 2015', 2015, 'Lujo', 300000, 125, 2, 'https://static.wikia.nocookie.net/emergency-response-liberty-county/images/a/ad/Falcon_Stallion_350_2015.png'),
('Ferdinand', 'Jalapeño Turbo 2022', 2022, 'Lujo', 260000, 155, 3, 'https://static.wikia.nocookie.net/emergency-response-liberty-county/images/e/ea/Ferdinand_Jalapeno_Turbo_2022.png'),
('Celestial', 'Truckatron 2024', 2024, 'Lujo', 400000, 122, 2, 'https://static.wikia.nocookie.net/emergency-response-liberty-county/images/3/35/Celestial_Truckatron_2024.png');

-- ============================================
-- CATEGORÍA: DEPORTIVO
-- ============================================

INSERT INTO dealership_catalog (make, model, year, category, price, speed, stock, image_url)
VALUES
('Chevlon', 'Corbeta X08 2014', 2014, 'Deportivo', 230000, 153, 3, 'https://static.wikia.nocookie.net/emergency-response-liberty-county/images/1/19/Chevlon_Corbeta_X08_2014.png'),
('BKM', 'Risen Roadster 2020', 2020, 'Deportivo', 350000, 146, 2, 'https://static.wikia.nocookie.net/emergency-response-liberty-county/images/1/15/BKM_Risen_Roadster_2020.png'),
('Navara', 'Horizon 2013', 2013, 'Deportivo', 430000, 157, 2, 'https://static.wikia.nocookie.net/emergency-response-liberty-county/images/7/79/Navara_Horizon_2013.png'),
('Chevlon', 'Corbeta RZR 2014', 2014, 'Deportivo', 460000, 163, 2, 'https://static.wikia.nocookie.net/emergency-response-liberty-county/images/d/d8/Chevlon_Corbeta_TZ_2014.png'),
('Chevlon', 'Corbeta 8 2023', 2023, 'Deportivo', 390000, 157, 2, 'https://static.wikia.nocookie.net/emergency-response-liberty-county/images/7/7a/Chevlon_Corbeta_8_2023.png'),
('Falcon', 'Heritage 2021', 2021, 'Deportivo', 480000, 168, 2, 'https://static.wikia.nocookie.net/emergency-response-liberty-county/images/3/38/Falcon_Heritage_2021.png'),
('Averon', 'R8 2017', 2017, 'Deportivo', 420000, 146, 2, 'https://static.wikia.nocookie.net/emergency-response-liberty-county/images/b/b5/Averon_R8_2017.png'),
('Surrey', '650S 2016', 2016, 'Deportivo', 380000, 150, 2, 'https://static.wikia.nocookie.net/emergency-response-liberty-county/images/2/28/Surrey_650S_2016.png'),
('Strugatti', 'Ettore 2020', 2020, 'Deportivo', 500000, 170, 1, 'https://static.wikia.nocookie.net/emergency-response-liberty-county/images/2/23/Strugatti_Ettore_2020.png'),
('Kovac', 'Heladera 2023', 2023, 'Deportivo', 600000, 180, 1, 'https://static.wikia.nocookie.net/emergency-response-liberty-county/images/b/b2/Kovac_Heladera_2023.jpeg');

-- ============================================
-- CATEGORÍA: MOTO
-- ============================================

INSERT INTO dealership_catalog (make, model, year, category, price, speed, stock, image_url)
VALUES
('Generic', '4-Wheeler', 2020, 'Moto', 50000, 60, 10, 'https://static.wikia.nocookie.net/emergency-response-liberty-county/images/a/a8/4-Wheeler_main.png'),
('Generic', 'Lawn Mower', 2018, 'Moto', 40000, 11, 10, 'https://static.wikia.nocookie.net/emergency-response-liberty-county/images/1/1f/Lawn_Mower.png'),
('Generic', 'Canyon Descender', 2019, 'Moto', 60000, 60, 10, 'https://static.wikia.nocookie.net/emergency-response-liberty-county/images/6/6b/Canyon_Descender_main.png');
