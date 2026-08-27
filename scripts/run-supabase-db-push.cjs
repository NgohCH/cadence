const {
  spawnSync,
} = require("node:child_process");

const {
  validateExplicitRemoteTarget,
} = require(
  "./assert-supabase-explicit-target.cjs"
);


const expectedEnvironment =
  process.argv[2];

const dryRun =
  process.argv.includes(
    "--dry-run"
  );


let target;

try {
  target =
    validateExplicitRemoteTarget(
      expectedEnvironment
    );
}
catch (error) {
  console.error(
    error instanceof Error
      ? error.message
      : String(error)
  );

  process.exit(1);
}


const commandParts = [
  "npx",
  "supabase",
  "db",
  "push",
  "--project-ref",
  target.projectRef,
];


if (dryRun) {
  commandParts.push(
    "--dry-run"
  );
}


const command =
  commandParts.join(" ");


console.log(
  `Running Supabase database ${dryRun ? "dry-run" : "push"} against explicit ${target.environment} target ${target.projectRef}.`
);


const commandProcessor =
  process.env.ComSpec ||
  "cmd.exe";


const result =
  spawnSync(
    commandProcessor,
    [
      "/d",
      "/s",
      "/c",
      command,
    ],
    {
      stdio:
        "inherit",

      env:
        process.env,
    }
  );


if (result.error) {
  console.error(
    `Unable to start Supabase CLI: ${result.error.message}`
  );

  process.exit(1);
}


process.exit(
  result.status ?? 1
);
