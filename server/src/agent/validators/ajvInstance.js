import Ajv from "ajv";

const ajv = new Ajv({
  allErrors: true,
  removeAdditional: false, // We want strict validation, we don't quietly remove additional properties
});

export default ajv;
