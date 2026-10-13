Real bird models (optional)
===========================
Put a .glb file here and list it in index.json. Any bird without a file keeps the built in model.

Example index.json:
{
  "eagle": { "file": "eagle.glb" },
  "hawk": { "file": "hawk.glb", "rotY": 3.14159 }
}

Keys are the bird ids: sparrow, kite, hawk, goose, osprey, falcon, swift, hummingbird, stork,
eagle, pelican, swan, peregrine, albatross, golden, crane, condor.

Options per bird:
  file   the .glb file name in this folder
  rotY   turn the model if it faces backwards (3.14159 for a half turn)
  scale  extra size multiplier (default 1)
  span   wingspan in game units (default is the bird's built in span)

The model should face along +Z with wings along the X axis. A flapping animation is used if the file has one.
Check the licence of every model. CC0 is free to use, CC BY needs a credit line in the game.
