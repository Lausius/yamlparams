import * as vscode from 'vscode';
import * as yaml from 'js-yaml';
import * as path from 'path';
import * as fs from 'fs';

export function activate(context: vscode.ExtensionContext) {
	let disposable = vscode.commands.registerCommand('yamlparams.formatYAML', async () => {
		const editor = vscode.window.activeTextEditor;

		if (editor) {
			const document = editor.document;
			const text = document.getText();
			const formattedYaml = await formatYAML(text, document.uri.fsPath);

			if (formattedYaml !== text) {
				editor.edit(editBuilder => {
					const fullRange = new vscode.Range(document.positionAt(0), document.positionAt(text.length));
					editBuilder.replace(fullRange, formattedYaml);
				});
			}
		}
	});

	context.subscriptions.push(disposable);
}

async function formatYAML(yamlText: string, filePath: string): Promise<string> {
	try {
		const parsedYaml = yaml.load(yamlText, { schema: yaml.JSON_SCHEMA });

		if (parsedYaml) {
			await validateParameters(parsedYaml, path.dirname(filePath));
			return yaml.dump(parsedYaml, { indent: 2 });
		}
	} catch (error: any) {
		vscode.window.showErrorMessage(`Failed to format YAML: ${error.message}`);
	}

	return yamlText; // Return the original text if formatting fails
}

async function validateParameters(parsedYaml: any, baseDir: string): Promise<void> {
	const templateFiles: string[] = [];
	const yamlParameters: string[] = [];

	// Recursive function to collect template files
	const collectTemplateFiles = (obj: any) => {
		for (const key in obj) {
			if (key === 'template') {
				templateFiles.push(obj[key]);
				// extract parameters
				if (obj.parameters) {
					for (const param in obj.parameters) {
						console.log(param);
						yamlParameters.push(param);
					}
				}
			} else if (typeof obj[key] === 'object') {
				collectTemplateFiles(obj[key]);
			}
		}
	};

	collectTemplateFiles(parsedYaml);

	// Validate parameters in template files
	for (const templateFile of templateFiles) {
		const templatePath = path.resolve(baseDir, templateFile);

		if (fs.existsSync(templatePath)) {
			const templateContent = fs.readFileSync(templatePath, 'utf-8');
			const templateParams: string[] = extractParametersFromTemplate(templateContent);

			if (templateParams && yamlParameters.length === 0) {
				vscode.window.showWarningMessage(`The YAML file '${templateFile}' is missing all necessary parameters ${templateParams.join(', ')}.`);
				continue;
			}

			// Validate if all required parameters are present in the main YAML file
			for (const param of templateParams) {
				const paramExists = yamlParameters.find(x => x === param);
				if (!paramExists) {
					vscode.window.showWarningMessage(`Parameter '${param}' is missing in the main YAML file: ${templateFile}.`);
				}
			}
		} else {
			vscode.window.showWarningMessage(`Template file '${templatePath}' not found.`);
		}
	}
}

function extractParametersFromTemplate(templateContent: string): string[] {
	const templateObj: any = yaml.load(templateContent, { schema: yaml.JSON_SCHEMA });
	const templateParams: string[] = [];

	if (templateObj && templateObj.parameters) {
		templateObj.parameters.forEach((param: any) => {
			console.log(param);
			templateParams.push(param.name);
		});
		return templateParams;
	}

	return [];
}
