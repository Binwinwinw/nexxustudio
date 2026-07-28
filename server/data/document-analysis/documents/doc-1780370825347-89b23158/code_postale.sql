-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Hôte : 127.0.0.1
-- Généré le : mer. 26 nov. 2025 à 01:44
-- Version du serveur : 10.4.32-MariaDB
-- Version de PHP : 8.4.14

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Base de données : `gestionepn`
--

-- --------------------------------------------------------

--
-- Structure de la table `code_postale`
--

CREATE TABLE `code_postale` (
  `id` int(11) NOT NULL,
  `cp` mediumint(11) DEFAULT NULL,
  `id_commune` int(11) DEFAULT NULL,
  `id_ville` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Index pour les tables déchargées
--

--
-- Index pour la table `code_postale`
--
ALTER TABLE `code_postale`
  ADD PRIMARY KEY (`id`),
  ADD KEY `codepostale_ibfk_1` (`id_commune`),
  ADD KEY `codepostale_ibfk_2` (`id_ville`);

--
-- AUTO_INCREMENT pour les tables déchargées
--

--
-- AUTO_INCREMENT pour la table `code_postale`
--
ALTER TABLE `code_postale`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- Contraintes pour les tables déchargées
--

--
-- Contraintes pour la table `code_postale`
--
ALTER TABLE `code_postale`
  ADD CONSTRAINT `codepostale_ibfk_1` FOREIGN KEY (`id_commune`) REFERENCES `commune` (`id_commune`),
  ADD CONSTRAINT `codepostale_ibfk_2` FOREIGN KEY (`id_ville`) REFERENCES `ville` (`id_ville`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
