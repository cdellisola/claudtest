// ===============================================================
//   NAME TAG GENERATOR (Waltograph / Disney style)
//   Basato sul design originale by Vanessa Matos
// ===============================================================
//
// Questo file carica il font DIRETTAMENTE dal disco (use <...>),
// quindi NON dipende dai font installati sul server/piattaforma.
// Metti il file del font in:   fonts/waltograph.ttf
//
// Generazione dei .3mf: usa ./generate.sh (vedi README.md)
// ---------------------------------------------------------------

// Carica il font dalla cartella fonts/ (percorso relativo a questo file).
// Se il file non esiste, OpenSCAD usa un font di ripiego e mostra un warning.
use <fonts/waltograph.ttf>

// ---------------------------------------------------------------
// USER PARAMETERS
// ---------------------------------------------------------------
Line1_Text      = "NAME";
Line2_Text      = "";
Line3_Text      = "";

// FONT SETTINGS
// Nome-FAMIGLIA del font (NON il nome del file!).
// Per Waltograph di solito e' "Waltograph UI" oppure "Waltograph42".
// Lo script generate.sh lo rileva in automatico con fc-scan e lo
// sovrascrive via -D, quindi qui basta un default sensato.
Font_Name       = "Waltograph UI";

Font_Size       = 20;

// Slider intero (compatibile MakerWorld) -> convertito in decimale
Font_Weight_Steps = 0;   // [-10:1:20]
Font_Weight = Font_Weight_Steps / 10;

// LETTER SPACING
Letter_Spacing = 1.0;   // [0.6:0.05:1.2]

// BASE OUTLINE (BLUE)
Use_Base_Outline     = 1;     // [0:Off, 1:On]
Base_Outline_Size    = 1;     // [0.5:0.1:5]
Base_Outline_Height  = 0.8;   // [0.2:0.1:5]

// MODEL SETTINGS
Text_Height     = 2;
Plate_Height    = 3;
Border_Size     = 3;

// BASE OPTION
Use_Offset      = 1;   // [0:Without Base, 1:With Base]

// LINE SPACING
Spacing_L2      = 1.1;
Spacing_L3      = 1.1;

// HORIZONTAL OFFSETS
Offset_L1       = 0;
Offset_L2       = 0;
Offset_L3       = 0;

$fn = 64;

// ---------------------------------------------------------------
// MODEL
// ---------------------------------------------------------------
if (Use_Offset == 1)
    generateBackPlate();

generateBaseTopOutline();   // BLUE OUTLINE ON TOP OF WHITE
generateKeychainText();

// ===============================================================
// MODULES
// ===============================================================

// BASE (WHITE)
module generateBackPlate() {
    color("White")
        linear_extrude(Plate_Height)
            offset(r = Border_Size)
                generateTextShape();
}

// BLUE OUTLINE ON TOP OF BASE (GROWS INWARD + CUSTOM HEIGHT)
module generateBaseTopOutline() {

    if (Use_Base_Outline == 1)
        color("#ADD8E6")   // light blue
            translate([0, 0, Plate_Height])   // sits ON TOP of the white base
                linear_extrude(Base_Outline_Height)   // custom height
                    difference() {

                        // Outer edge stays EXACTLY the same as the white base
                        offset(r = Border_Size)
                            generateTextShape();

                        // Inner edge moves inward when Base_Outline_Size increases
                        offset(r = Border_Size - Base_Outline_Size)
                            generateTextShape();
                    }
}

// TEXT (LIGHT LILAC)
module generateKeychainText() {

    color("#D8B7FF")
        translate([0, 0, Plate_Height])
            linear_extrude(Text_Height)
                generateTextShape();
}

// TEXT SHAPE (3 LINES)
module generateTextShape() {

    if (Line1_Text != "")
        translate([Offset_L1, 0, 0])
            offset(delta = Font_Weight)
                text(Line1_Text, size = Font_Size, font = Font_Name, spacing = Letter_Spacing);

    if (Line2_Text != "")
        translate([Offset_L2, -Font_Size * Spacing_L2, 0])
            offset(delta = Font_Weight)
                text(Line2_Text, size = Font_Size, font = Font_Name, spacing = Letter_Spacing);

    if (Line3_Text != "")
        translate([Offset_L3, -Font_Size * (Spacing_L2 + Spacing_L3), 0])
            offset(delta = Font_Weight)
                text(Line3_Text, size = Font_Size, font = Font_Name, spacing = Letter_Spacing);
}
